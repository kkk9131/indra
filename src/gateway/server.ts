import { Hono } from "hono";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { createServer, type Server } from "http";
import { SessionManager } from "../infra/index.js";
import { ConfigManager, type Config } from "../config/index.js";
import {
  AgentSDKProvider,
  type AgentChatOptions,
  type AgentOptions,
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
import {
  XOAuth2Handler,
  getCredentialStore,
  type CredentialStore,
} from "../auth/index.js";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function sendResponse(
  ws: WebSocket,
  id: string,
  ok: boolean,
  payload?: unknown,
  error?: { code: string; message: string },
): void {
  ws.send(JSON.stringify(createResponse(id, ok, payload, error)));
}

function sendError(
  ws: WebSocket,
  id: string,
  code: string,
  message: string,
): void {
  sendResponse(ws, id, false, undefined, { code, message });
}

function sendSuccess(ws: WebSocket, id: string, payload?: unknown): void {
  sendResponse(ws, id, true, payload);
}

export class GatewayServer {
  private app: Hono;
  private httpServer: Server;
  private wss: WebSocketServer;
  private sessionManager: SessionManager;
  private configManager: ConfigManager;
  private approvalQueue: ApprovalQueue;
  private xConnector: XConnector | null = null;
  private xOAuth2Handler: XOAuth2Handler | null = null;
  private credentialStore: CredentialStore;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port = 3001) {
    this.port = port;
    this.app = new Hono();
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.sessionManager = new SessionManager();
    this.configManager = new ConfigManager();
    this.approvalQueue = new ApprovalQueue();
    this.credentialStore = getCredentialStore();

    this.setupRoutes();
    this.setupWebSocket();
    this.initConnectors();
    this.initOAuth2();
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

  private initOAuth2(): void {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    const redirectUri =
      process.env.X_REDIRECT_URI ?? "http://localhost:5173/callback.html";

    if (clientId) {
      this.xOAuth2Handler = new XOAuth2Handler({
        clientId,
        clientSecret,
        redirectUri,
      });
    }
  }

  private createLLMProvider(config: Config["llm"]): LLMProvider {
    return new AgentSDKProvider({
      model: config.model,
      systemPrompt: config.systemPrompt,
    });
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
      this.clients.add(ws);

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
        this.clients.delete(ws);
        this.sessionManager.delete(session.id);
      });

      ws.on("error", (err) => {
        console.error("WebSocket error:", err);
      });
    });
  }

  /**
   * Broadcast an event to all connected clients
   */
  private broadcast(event: string, payload: unknown): void {
    const message = JSON.stringify(createEvent(event, payload));
    for (const client of this.clients) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(message);
      }
    }
  }

  private async handleRequest(
    ws: WebSocket,
    _sessionId: string,
    frame: RequestFrame,
  ): Promise<void> {
    switch (frame.method) {
      case "ping":
        sendSuccess(ws, frame.id, { pong: Date.now() });
        break;

      case "chat.send":
        await this.handleChatSend(ws, frame);
        break;

      case "config.get":
        sendSuccess(ws, frame.id, { config: this.configManager.get() });
        break;

      case "config.set":
        try {
          const configUpdate = frame.params as Partial<Config>;
          this.configManager.set(configUpdate);
          sendSuccess(ws, frame.id, { config: this.configManager.get() });
        } catch (error) {
          sendError(ws, frame.id, "CONFIG_ERROR", getErrorMessage(error));
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

      case "auth.x.start":
        this.handleAuthXStart(ws, frame);
        break;

      case "auth.x.callback":
        await this.handleAuthXCallback(ws, frame);
        break;

      case "auth.x.status":
        this.handleAuthXStatus(ws, frame);
        break;

      case "auth.x.logout":
        this.handleAuthXLogout(ws, frame);
        break;

      default:
        sendError(
          ws,
          frame.id,
          "UNKNOWN_METHOD",
          `Unknown method: ${frame.method}`,
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
      const params = frame.params as {
        message: string;
        history?: Message[];
        agentMode?: boolean;
        agentOptions?: AgentOptions;
      };
      const config = this.configManager.get();
      const provider = this.createLLMProvider(config.llm);

      const messages: Message[] = [
        ...(params.history ?? []),
        { role: "user", content: params.message },
      ];

      // Use agent mode if requested
      if (params.agentMode && provider.chatStreamWithAgent) {
        await this.handleAgentChat(
          ws,
          provider,
          messages,
          config,
          params.agentOptions,
        );
      } else {
        await this.handleSimpleChat(ws, provider, messages, config);
      }

      ws.send(JSON.stringify(createEvent("chat.done", {})));
      sendSuccess(ws, frame.id);
    } catch (error) {
      console.error("LLM Error:", error);
      sendError(ws, frame.id, "LLM_ERROR", getErrorMessage(error));
    }
  }

  private async handleSimpleChat(
    ws: WebSocket,
    provider: LLMProvider,
    messages: Message[],
    config: Config,
  ): Promise<void> {
    const options = { systemPrompt: config.llm.systemPrompt };

    for await (const chunk of provider.chatStream(messages, options)) {
      ws.send(JSON.stringify(createEvent("chat.chunk", { text: chunk })));
    }
  }

  private async handleAgentChat(
    ws: WebSocket,
    provider: LLMProvider,
    messages: Message[],
    config: Config,
    agentOptions?: AgentOptions,
  ): Promise<void> {
    if (!provider.chatStreamWithAgent) {
      throw new Error("Agent mode not supported by this provider");
    }

    const options: AgentChatOptions = {
      systemPrompt: config.llm.systemPrompt,
      agent: {
        maxTurns: agentOptions?.maxTurns ?? 10,
        tools: agentOptions?.tools ?? [
          "Read",
          "Glob",
          "Grep",
          "Bash",
          "WebSearch",
        ],
        permissionMode: agentOptions?.permissionMode ?? "acceptEdits",
      },
    };

    for await (const event of provider.chatStreamWithAgent(messages, options)) {
      switch (event.type) {
        case "text":
          ws.send(
            JSON.stringify(createEvent("chat.chunk", { text: event.text })),
          );
          break;
        case "tool_start":
          ws.send(
            JSON.stringify(
              createEvent("agent.tool_start", {
                tool: event.tool,
                input: event.input,
                toolUseId: event.toolUseId,
              }),
            ),
          );
          break;
        case "tool_result":
          ws.send(
            JSON.stringify(
              createEvent("agent.tool_result", {
                tool: event.tool,
                result: event.result,
                toolUseId: event.toolUseId,
              }),
            ),
          );
          break;
        case "turn_complete":
          ws.send(
            JSON.stringify(
              createEvent("agent.turn_complete", {
                turnNumber: event.turnNumber,
              }),
            ),
          );
          break;
        case "done":
          // Final result is handled by chat.done
          break;
      }
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
      sendSuccess(ws, frame.id, { success: true, response });
    } catch (error) {
      sendError(ws, frame.id, "LLM_TEST_FAILED", getErrorMessage(error));
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

      // Broadcast to all clients
      this.broadcast("post.created", { item });
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

    // Check for OAuth2 credentials first
    const xCreds = this.credentialStore.getXCredentials();
    let connector: XConnector;

    if (xCreds && !this.credentialStore.isXTokenExpired()) {
      // Use OAuth2 token
      connector = new XConnector({ oauth2AccessToken: xCreds.accessToken });
    } else if (this.xConnector) {
      // Fall back to OAuth 1.0a
      connector = this.xConnector;
    } else {
      const failedItem = this.approvalQueue.markFailed(
        id,
        "X connector not configured",
      );
      this.broadcast("post.updated", { item: failedItem });
      sendError(
        ws,
        frame.id,
        "CONNECTOR_NOT_CONFIGURED",
        "X connector not configured. Authenticate via OAuth 2.0 or set OAuth 1.0a environment variables.",
      );
      return;
    }

    try {
      await connector.connect();
      const result = await connector.post(item.content);

      if (result.success && result.postId && result.url) {
        const postedItem = this.approvalQueue.markPosted(
          id,
          result.postId,
          result.url,
        );
        sendSuccess(ws, frame.id, { item: postedItem });
        this.broadcast("post.updated", { item: postedItem });
      } else {
        const failedItem = this.approvalQueue.markFailed(
          id,
          result.error ?? "Unknown error",
        );
        this.broadcast("post.updated", { item: failedItem });
        sendError(
          ws,
          frame.id,
          "POST_FAILED",
          result.error ?? "Failed to post",
        );
      }
    } catch (error) {
      const failedItem = this.approvalQueue.markFailed(
        id,
        getErrorMessage(error),
      );
      this.broadcast("post.updated", { item: failedItem });
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
    this.broadcast("post.updated", { item });
  }

  private handlePostEdit(ws: WebSocket, frame: RequestFrame): void {
    const { id, content } = frame.params as { id: string; content: Content };
    const item = this.approvalQueue.update(id, { content });

    if (!item) {
      sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
      return;
    }

    sendSuccess(ws, frame.id, { item });
    this.broadcast("post.updated", { item });
  }

  // ===== Auth Handlers =====

  private handleAuthXStart(ws: WebSocket, frame: RequestFrame): void {
    if (!this.xOAuth2Handler) {
      sendError(
        ws,
        frame.id,
        "OAUTH_NOT_CONFIGURED",
        "X OAuth 2.0 not configured. Set X_CLIENT_ID environment variable.",
      );
      return;
    }

    const { url, state } = this.xOAuth2Handler.generateAuthUrl();
    sendSuccess(ws, frame.id, { url, state });
  }

  private async handleAuthXCallback(
    ws: WebSocket,
    frame: RequestFrame,
  ): Promise<void> {
    if (!this.xOAuth2Handler) {
      sendError(
        ws,
        frame.id,
        "OAUTH_NOT_CONFIGURED",
        "X OAuth 2.0 not configured.",
      );
      return;
    }

    const { code, state } = frame.params as { code: string; state: string };

    try {
      const tokens = await this.xOAuth2Handler.handleCallback(code, state);

      // Fetch user info to get username
      let username: string | undefined;
      try {
        const userResponse = await fetch("https://api.twitter.com/2/users/me", {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
        if (userResponse.ok) {
          const userData = (await userResponse.json()) as {
            data: { username: string };
          };
          username = userData.data.username;
        }
      } catch {
        // Ignore user fetch error
      }

      this.credentialStore.setXCredentials(tokens, username);
      sendSuccess(ws, frame.id, { success: true, username });
    } catch (error) {
      sendError(ws, frame.id, "AUTH_CALLBACK_ERROR", getErrorMessage(error));
    }
  }

  private handleAuthXStatus(ws: WebSocket, frame: RequestFrame): void {
    const creds = this.credentialStore.getXCredentials();
    const authenticated = this.credentialStore.isXAuthenticated();
    const expired = this.credentialStore.isXTokenExpired();

    sendSuccess(ws, frame.id, {
      authenticated,
      expired,
      username: creds?.username,
      oauth2Configured: !!this.xOAuth2Handler,
      oauth1Configured: !!this.xConnector,
    });
  }

  private handleAuthXLogout(ws: WebSocket, frame: RequestFrame): void {
    this.credentialStore.clearXCredentials();
    sendSuccess(ws, frame.id, { success: true });
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
