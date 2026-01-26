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
  GLMProvider,
  type LLMProvider,
  type Message,
} from "../llm/index.js";
import {
  FrameSchema,
  createResponse,
  createEvent,
  type RequestFrame,
} from "./protocol/index.js";
import { ApprovalQueue, type ApprovalStatus } from "../approval/index.js";
import {
  XConnector,
  type Platform,
  type Content,
} from "../connectors/index.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function sendError(
  ws: WebSocket,
  id: string,
  code: string,
  message: string,
): void {
  ws.send(
    JSON.stringify(createResponse(id, false, undefined, { code, message })),
  );
}

function sendSuccess(ws: WebSocket, id: string, payload?: unknown): void {
  ws.send(JSON.stringify(createResponse(id, true, payload)));
}

export class GatewayServer {
  private app: Hono;
  private httpServer: Server;
  private wss: WebSocketServer;
  private sessionManager: SessionManager;
  private configManager: ConfigManager;
  private approvalQueue: ApprovalQueue;
  private xConnector: XConnector | null = null;
  private port: number;

  constructor(port = 3001) {
    this.port = port;
    this.app = new Hono();
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.sessionManager = new SessionManager();
    this.configManager = new ConfigManager();
    this.approvalQueue = new ApprovalQueue();

    this.setupRoutes();
    this.setupWebSocket();
    this.initConnectors();
  }

  private initConnectors(): void {
    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessSecret = process.env.X_ACCESS_SECRET;

    if (apiKey && apiSecret && accessToken && accessSecret) {
      this.xConnector = new XConnector({
        apiKey,
        apiSecret,
        accessToken,
        accessSecret,
      });
    }
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
      case "glm":
        return new GLMProvider(providerConfig);
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

      case "post.create":
        await this.handlePostCreate(ws, frame);
        break;

      case "post.list":
        this.handlePostList(ws, frame);
        break;

      case "post.approve":
        await this.handlePostApprove(ws, frame);
        break;

      case "post.reject":
        this.handlePostReject(ws, frame);
        break;

      case "post.edit":
        this.handlePostEdit(ws, frame);
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
    console.log(
      "[Gateway] handleChatSend called:",
      JSON.stringify(frame.params),
    );
    try {
      const params = frame.params as { message: string; history?: Message[] };
      const config = this.configManager.get();
      console.log("[Gateway] LLM config:", JSON.stringify(config.llm));
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
      console.error("LLM Error:", error);
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

  private async handlePostCreate(
    ws: WebSocket,
    frame: RequestFrame,
  ): Promise<void> {
    try {
      const { platform, prompt } = frame.params as {
        platform: Platform;
        prompt: string;
      };
      const config = this.configManager.get();
      const provider = this.createLLMProvider(config.llm);

      const systemPrompt = `You are a social media content creator. Generate a concise, engaging post for ${platform}.
Keep it under 280 characters. Be creative and natural. Output ONLY the post text, no explanations.`;

      const generatedText = await provider.chat(
        [{ role: "user", content: prompt }],
        { systemPrompt },
      );
      const item = this.approvalQueue.create({
        platform,
        content: { text: generatedText.slice(0, 280) },
        prompt,
      });

      sendSuccess(ws, frame.id, { item });
    } catch (error) {
      sendError(ws, frame.id, "POST_CREATE_ERROR", getErrorMessage(error));
    }
  }

  private handlePostList(ws: WebSocket, frame: RequestFrame): void {
    const params = frame.params as { status?: ApprovalStatus } | undefined;
    sendSuccess(ws, frame.id, {
      items: this.approvalQueue.list(params?.status),
    });
  }

  private async handlePostApprove(
    ws: WebSocket,
    frame: RequestFrame,
  ): Promise<void> {
    const { id } = frame.params as { id: string };

    const item = this.approvalQueue.approve(id);
    if (!item) {
      sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
      return;
    }

    if (item.platform !== "x") {
      sendError(
        ws,
        frame.id,
        "UNSUPPORTED_PLATFORM",
        `Platform not yet supported: ${item.platform}`,
      );
      return;
    }

    if (!this.xConnector) {
      this.approvalQueue.markFailed(id, "X connector not configured");
      sendError(
        ws,
        frame.id,
        "CONNECTOR_NOT_CONFIGURED",
        "X connector not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.",
      );
      return;
    }

    try {
      await this.xConnector.connect();
      const result = await this.xConnector.post(item.content);

      if (result.success && result.postId && result.url) {
        sendSuccess(ws, frame.id, {
          item: this.approvalQueue.markPosted(id, result.postId, result.url),
        });
      } else {
        this.approvalQueue.markFailed(id, result.error ?? "Unknown error");
        sendError(
          ws,
          frame.id,
          "POST_FAILED",
          result.error ?? "Failed to post",
        );
      }
    } catch (error) {
      this.approvalQueue.markFailed(id, getErrorMessage(error));
      sendError(ws, frame.id, "POST_ERROR", getErrorMessage(error));
    }
  }

  private handlePostReject(ws: WebSocket, frame: RequestFrame): void {
    const { id } = frame.params as { id: string };
    const item = this.approvalQueue.reject(id);

    if (!item) {
      sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
      return;
    }

    sendSuccess(ws, frame.id, { item });
  }

  private handlePostEdit(ws: WebSocket, frame: RequestFrame): void {
    const { id, content } = frame.params as { id: string; content: Content };
    const item = this.approvalQueue.update(id, { content });

    if (!item) {
      sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
      return;
    }

    sendSuccess(ws, frame.id, { item });
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
