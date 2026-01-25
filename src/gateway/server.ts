import { Hono } from "hono";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { createServer, type Server } from "http";
import { SessionManager } from "../infra/index.js";
import { ConfigManager, type Config } from "../config/index.js";
import {
  AnthropicProvider,
  OpenAIProvider,
  GoogleProvider,
  OllamaProvider,
  type LLMProvider,
  type Message,
} from "../llm/index.js";
import {
  FrameSchema,
  createResponse,
  createEvent,
  type RequestFrame,
} from "./protocol/index.js";

export class GatewayServer {
  private app: Hono;
  private httpServer: Server;
  private wss: WebSocketServer;
  private sessionManager: SessionManager;
  private configManager: ConfigManager;
  private port: number;

  constructor(port = 3001) {
    this.port = port;
    this.app = new Hono();
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.sessionManager = new SessionManager();
    this.configManager = new ConfigManager();

    this.setupRoutes();
    this.setupWebSocket();
  }

  private createLLMProvider(config: Config["llm"]): LLMProvider {
    const providerConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      defaultModel: config.model,
      defaultTemperature: config.temperature,
      defaultMaxTokens: config.maxTokens,
    };

    switch (config.provider) {
      case "anthropic":
        return new AnthropicProvider(providerConfig);
      case "openai":
        return new OpenAIProvider(providerConfig);
      case "google":
        return new GoogleProvider(providerConfig);
      case "ollama":
        return new OllamaProvider(providerConfig);
    }
  }

  private setupRoutes(): void {
    this.app.get("/health", (c) =>
      c.json({ status: "ok", timestamp: Date.now() }),
    );
    this.app.get("/sessions", (c) => {
      const sessions = this.sessionManager.list();
      return c.json({ sessions });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws, _req) => {
      const session = this.sessionManager.create("web");

      ws.send(
        JSON.stringify(
          createResponse(session.id, true, { sessionId: session.id }),
        ),
      );

      ws.on("message", async (data: Buffer) => {
        try {
          const text = data.toString("utf-8");
          const frame = FrameSchema.parse(JSON.parse(text));

          if (frame.type === "req") {
            this.sessionManager.updateLastSeen(session.id);
            await this.handleRequest(ws, session.id, frame);
          }
        } catch (error) {
          ws.send(
            JSON.stringify(
              createResponse("", false, undefined, {
                code: "INVALID_FRAME",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              }),
            ),
          );
        }
      });

      ws.on("close", () => {
        this.sessionManager.delete(session.id);
      });

      ws.on("error", (err) => {
        console.error("WebSocket error:", err);
      });
    });
  }

  private async handleRequest(
    ws: WebSocket,
    _sessionId: string,
    frame: RequestFrame,
  ): Promise<void> {
    switch (frame.method) {
      case "ping":
        ws.send(
          JSON.stringify(createResponse(frame.id, true, { pong: Date.now() })),
        );
        break;

      case "chat.send":
        await this.handleChatSend(ws, frame);
        break;

      case "config.get":
        ws.send(
          JSON.stringify(
            createResponse(frame.id, true, {
              config: this.configManager.get(),
            }),
          ),
        );
        break;

      case "config.set":
        try {
          const configUpdate = frame.params as Partial<Config>;
          this.configManager.set(configUpdate);
          ws.send(
            JSON.stringify(
              createResponse(frame.id, true, {
                config: this.configManager.get(),
              }),
            ),
          );
        } catch (error) {
          ws.send(
            JSON.stringify(
              createResponse(frame.id, false, undefined, {
                code: "CONFIG_ERROR",
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to set config",
              }),
            ),
          );
        }
        break;

      case "llm.test":
        await this.handleLLMTest(ws, frame);
        break;

      default:
        ws.send(
          JSON.stringify(
            createResponse(frame.id, false, undefined, {
              code: "UNKNOWN_METHOD",
              message: `Unknown method: ${frame.method}`,
            }),
          ),
        );
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`Gateway server running on http://localhost:${this.port}`);
        console.log(`WebSocket server running on ws://localhost:${this.port}`);
        resolve();
      });
    });
  }

  private async handleChatSend(
    ws: WebSocket,
    frame: RequestFrame,
  ): Promise<void> {
    try {
      const params = frame.params as { message: string; history?: Message[] };
      const config = this.configManager.get();
      const provider = this.createLLMProvider(config.llm);

      const messages: Message[] = [
        ...(params.history ?? []),
        { role: "user", content: params.message },
      ];

      const options = {
        systemPrompt: config.llm.systemPrompt,
      };

      // Stream response
      for await (const chunk of provider.chatStream(messages, options)) {
        ws.send(JSON.stringify(createEvent("chat.chunk", { text: chunk })));
      }

      ws.send(JSON.stringify(createEvent("chat.done", {})));
      ws.send(JSON.stringify(createResponse(frame.id, true)));
    } catch (error) {
      ws.send(
        JSON.stringify(
          createResponse(frame.id, false, undefined, {
            code: "LLM_ERROR",
            message: error instanceof Error ? error.message : "LLM call failed",
          }),
        ),
      );
    }
  }

  private async handleLLMTest(
    ws: WebSocket,
    frame: RequestFrame,
  ): Promise<void> {
    try {
      const config = this.configManager.get();
      const provider = this.createLLMProvider(config.llm);

      const testMessages: Message[] = [
        {
          role: "user",
          content: "Hello, please respond with 'OK' if you can hear me.",
        },
      ];

      const response = await provider.chat(testMessages);
      ws.send(
        JSON.stringify(
          createResponse(frame.id, true, { success: true, response }),
        ),
      );
    } catch (error) {
      ws.send(
        JSON.stringify(
          createResponse(frame.id, false, undefined, {
            code: "LLM_TEST_FAILED",
            message:
              error instanceof Error ? error.message : "Connection test failed",
          }),
        ),
      );
    }
  }

  stop(): void {
    this.wss.close();
    this.httpServer.close();
    this.sessionManager.close();
    this.configManager.close();
  }

  getServer(): Server {
    return this.httpServer;
  }
}
