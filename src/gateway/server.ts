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
import {
  createHandlerRegistry,
  type GatewayContext,
  type RequestHandler,
} from "./handlers/index.js";
import { ApprovalQueue } from "../approval/index.js";
import {
  XConnector,
  type Platform,
} from "../connectors/index.js";
import {
  NewsStore,
  NewsScheduler,
  NewsSourceStore,
  fetchXAccount,
  tweetToArticle,
  type NewsSourceDefinition,
  type CreateNewsSourceParams,
  type UpdateNewsSourceParams,
  type XAccountConfig,
} from "../news/index.js";
import {
  XOAuth2Handler,
  getCredentialStore,
  type CredentialStore,
} from "../auth/index.js";
import { DiscordBot, commands as discordCommands } from "../discord/index.js";
import { LogStore, LogCollector, type AgentActionType } from "../logs/index.js";
import type { ApprovalItem } from "../approval/types.js";
import {
  AnalyticsScheduler,
  createReportEmbed,
  type DailyReport,
} from "../analytics/index.js";
import type { NewsArticle } from "../news/types.js";
import {
  SchedulerManager,
  ScheduleStore,
  TaskRegistry,
  TaskExecutor,
  type TaskExecutionResult,
} from "../scheduler/index.js";
import {
  XPostWorkflowService,
  type XPostProgressEvent,
  type XPostWorkflowOptions,
} from "../xpost/index.js";

interface AgentLogParams {
  tool?: string;
  toolInput?: unknown;
  toolResult?: string;
  turnNumber?: number;
  text?: string;
}

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

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3048",
  "http://127.0.0.1:3048",
];

const ALLOWED_ORIGINS = new Set(
  (process.env.GATEWAY_ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const WS_TOKEN = process.env.GATEWAY_WS_TOKEN;

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  return ALLOWED_ORIGINS.has(origin);
}

function isTokenAllowed(req: {
  url?: string;
  headers?: { host?: string };
}): boolean {
  if (!WS_TOKEN) {
    return true;
  }
  try {
    const url = new URL(
      req.url ?? "",
      `http://${req.headers?.host ?? "localhost"}`,
    );
    const token = url.searchParams.get("token");
    return token === WS_TOKEN;
  } catch {
    return false;
  }
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
  private discordBot: DiscordBot | null = null;
  private newsStore: NewsStore;
  private newsSourceStore: NewsSourceStore;
  private newsScheduler: NewsScheduler;
  private logStore: LogStore;
  private logCollector: LogCollector;
  private analyticsScheduler: AnalyticsScheduler | null = null;
  private schedulerManager: SchedulerManager;
  private scheduleStore: ScheduleStore;
  private taskRegistry: TaskRegistry;
  private taskExecutor: TaskExecutor;
  private xpostWorkflowService: XPostWorkflowService;
  private requestHandlers: Map<string, RequestHandler>;
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

    this.newsStore = new NewsStore();
    this.newsSourceStore = new NewsSourceStore();
    this.newsScheduler = new NewsScheduler(this.newsStore, (articles) => {
      this.broadcast("news.updated", { articles });
    });

    this.logStore = new LogStore();
    this.logCollector = new LogCollector({
      sessionId: "gateway",
      maxLength: 5000,
    });

    // スケジューラーを初期化
    this.scheduleStore = new ScheduleStore();
    this.taskRegistry = new TaskRegistry();
    this.taskExecutor = new TaskExecutor(
      this.taskRegistry,
      this.scheduleStore,
      (result) => this.handleTaskExecuted(result),
    );
    this.schedulerManager = new SchedulerManager(
      this.scheduleStore,
      this.taskRegistry,
      this.taskExecutor,
      (task) => this.broadcast("schedule.updated", { task }),
    );

    this.xpostWorkflowService = new XPostWorkflowService();

    this.setupRoutes();
    this.setupWebSocket();
    this.initConnectors();
    this.initOAuth2();
    this.initDiscordBot();
    this.initAnalytics();
    this.initScheduledTasks();
    this.requestHandlers = createHandlerRegistry(this.buildHandlerContext());
  }

  private initAnalytics(): void {
    // ZAI_API_KEY がない場合はスキップ
    console.log(
      "initAnalytics: ZAI_API_KEY =",
      process.env.ZAI_API_KEY ? "set" : "not set",
    );
    if (!process.env.ZAI_API_KEY) {
      console.log("AnalyticsScheduler: Skipped (ZAI_API_KEY not set)");
      return;
    }

    try {
      this.analyticsScheduler = new AnalyticsScheduler((report, article) =>
        this.handleReportGenerated(report, article),
      );
      console.log("AnalyticsScheduler: Initialized successfully");
      // AnalyticsSchedulerの固定cronは使わず、SchedulerManagerで管理
    } catch (error) {
      console.error("Failed to initialize analytics:", error);
    }
  }

  private initScheduledTasks(): void {
    // タスク定義を登録
    this.schedulerManager.registerTaskType({
      type: "news",
      name: "ニュース取得",
      description: "Anthropic News を取得",
      execute: () => this.newsScheduler.run(),
      defaultCron: "0 6 * * *",
    });

    if (this.analyticsScheduler) {
      this.schedulerManager.registerTaskType({
        type: "analytics",
        name: "ログ分析",
        description: "日次ログ分析レポートを生成",
        execute: () => this.analyticsScheduler!.run().then(() => {}),
        defaultCron: "0 5 * * *",
      });
    }

    // デフォルトタスクを登録（存在しない場合のみ）
    this.schedulerManager.ensureDefaultTask(
      "news",
      "ニュース取得",
      "毎朝6時にAnthropic Newsを取得",
      "0 6 * * *",
    );

    if (this.analyticsScheduler) {
      this.schedulerManager.ensureDefaultTask(
        "analytics",
        "ログ分析",
        "毎朝5時に日次ログ分析レポートを生成",
        "0 5 * * *",
      );
    }

    // スケジューラーを開始
    this.schedulerManager.start();
    console.log("SchedulerManager: Initialized and started");
  }

  private handleTaskExecuted(result: TaskExecutionResult): void {
    this.broadcast("schedule.executed", {
      id: result.taskId,
      success: result.success,
      error: result.error,
    });
  }

  private async handleReportGenerated(
    report: DailyReport,
    article: NewsArticle,
  ): Promise<void> {
    // 1. NewsStoreに保存
    this.newsStore.save([article]);

    // 2. WebSocketブロードキャスト
    const articles = this.newsStore.list();
    this.broadcast("news.updated", { articles });

    // 3. Discord通知
    const channelId = process.env.DISCORD_REPORT_CHANNEL_ID;
    if (channelId && this.discordBot?.isReady()) {
      const embed = createReportEmbed(report);
      const result = await this.discordBot.sendEmbed(channelId, embed);
      if (!result.success) {
        console.error("Failed to send report to Discord:", result.error);
      }
    }
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

  private initDiscordBot(): void {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildIds = process.env.DISCORD_GUILD_IDS?.split(",").filter(Boolean);

    if (token && clientId) {
      this.discordBot = new DiscordBot({
        token,
        clientId,
        guildIds,
      });

      // Register commands
      for (const command of discordCommands) {
        this.discordBot.registerCommand(command);
      }

      // Set gateway reference for commands to use
      this.discordBot.setGateway(this);
    }
  }

  async startDiscordBot(): Promise<void> {
    if (this.discordBot) {
      await this.discordBot.start();
      console.log("Discord bot started");
    }
  }

  async stopDiscordBot(): Promise<void> {
    if (this.discordBot) {
      await this.discordBot.stop();
    }
  }

  isDiscordBotReady(): boolean {
    return this.discordBot?.isReady() ?? false;
  }

  /** Helper to save agent logs consistently */
  private saveAgentLog(action: AgentActionType, params: AgentLogParams): void {
    const logEntry = this.logCollector.addAgentLog(
      action,
      params.tool,
      params.toolInput,
      params.toolResult,
      params.turnNumber,
      params.text,
    );
    this.logStore.save(logEntry);
    // ブロードキャストを追加
    this.broadcast("logs.updated", { log: logEntry });
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
    this.wss.on("connection", (ws, req) => {
      if (!isTokenAllowed(req)) {
        console.warn("WebSocket connection rejected (invalid token)");
        ws.close(1008, "Invalid token");
        return;
      }
      const origin = req.headers.origin;
      if (!isOriginAllowed(origin)) {
        console.warn(`WebSocket connection rejected (origin: ${origin})`);
        ws.close(1008, "Origin not allowed");
        return;
      }
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

  private buildHandlerContext(): GatewayContext {
    return {
      configManager: this.configManager,
      approvalQueue: this.approvalQueue,
      credentialStore: this.credentialStore,
      xConnector: this.xConnector,
      xOAuth2Handler: this.xOAuth2Handler,
      discordBot: this.discordBot,
      isDiscordBotReady: () => this.isDiscordBotReady(),
      newsStore: this.newsStore,
      newsScheduler: this.newsScheduler,
      logStore: this.logStore,
      analyticsScheduler: this.analyticsScheduler,
      schedulerManager: this.schedulerManager,
      createLLMProvider: (config) => this.createLLMProvider(config),
      broadcast: (event, payload) => this.broadcast(event, payload),
      sendSuccess,
      sendError,
      getErrorMessage,
      handlers: {
        handleChatSend: this.handleChatSend.bind(this),
        handleLLMTest: this.handleLLMTest.bind(this),
        handleNewsSourceList: this.handleNewsSourceList.bind(this),
        handleNewsSourceGet: this.handleNewsSourceGet.bind(this),
        handleNewsSourceCreate: this.handleNewsSourceCreate.bind(this),
        handleNewsSourceUpdate: this.handleNewsSourceUpdate.bind(this),
        handleNewsSourceDelete: this.handleNewsSourceDelete.bind(this),
        handleNewsSourceToggle: this.handleNewsSourceToggle.bind(this),
        handleNewsSourceFetchNow: this.handleNewsSourceFetchNow.bind(this),
        handleXpostGenerate: this.handleXpostGenerate.bind(this),
      },
    };
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
    const handler = this.requestHandlers.get(frame.method);
    if (!handler) {
      sendError(
        ws,
        frame.id,
        "UNKNOWN_METHOD",
        `Unknown method: ${frame.method}`,
      );
      return;
    }
    await handler(ws, frame);
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
          "Skill",
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
          this.saveAgentLog("text", { text: event.text });
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
          this.saveAgentLog("tool_start", {
            tool: event.tool,
            toolInput: event.input,
          });
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
          this.saveAgentLog("tool_result", {
            tool: event.tool,
            toolResult: event.result,
          });
          break;
        case "turn_complete":
          ws.send(
            JSON.stringify(
              createEvent("agent.turn_complete", {
                turnNumber: event.turnNumber,
              }),
            ),
          );
          this.saveAgentLog("turn_complete", { turnNumber: event.turnNumber });
          break;
        case "done":
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
  // ===== NewsSource Handlers =====

  private handleNewsSourceList(ws: WebSocket, frame: RequestFrame): void {
    const sources = this.newsSourceStore.list();
    sendSuccess(ws, frame.id, { sources });
  }

  private handleNewsSourceGet(ws: WebSocket, frame: RequestFrame): void {
    const { id } = frame.params as { id: string };
    const source = this.newsSourceStore.get(id);
    if (!source) {
      sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
      return;
    }
    sendSuccess(ws, frame.id, { source });
  }

  private handleNewsSourceCreate(ws: WebSocket, frame: RequestFrame): void {
    try {
      const params = frame.params as CreateNewsSourceParams;
      const source = this.newsSourceStore.create(params);
      sendSuccess(ws, frame.id, { source });
      this.broadcast("newsSource.updated", { source });
    } catch (error) {
      sendError(ws, frame.id, "CREATE_ERROR", getErrorMessage(error));
    }
  }

  private handleNewsSourceUpdate(ws: WebSocket, frame: RequestFrame): void {
    try {
      const { id, ...params } = frame.params as {
        id: string;
      } & UpdateNewsSourceParams;
      const source = this.newsSourceStore.update(id, params);
      if (!source) {
        sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
        return;
      }
      sendSuccess(ws, frame.id, { source });
      this.broadcast("newsSource.updated", { source });
    } catch (error) {
      sendError(ws, frame.id, "UPDATE_ERROR", getErrorMessage(error));
    }
  }

  private handleNewsSourceDelete(ws: WebSocket, frame: RequestFrame): void {
    const { id } = frame.params as { id: string };
    const deleted = this.newsSourceStore.delete(id);
    if (!deleted) {
      sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
      return;
    }
    sendSuccess(ws, frame.id, { deleted: true });
    this.broadcast("newsSource.deleted", { id });
  }

  private handleNewsSourceToggle(ws: WebSocket, frame: RequestFrame): void {
    const { id, enabled } = frame.params as { id: string; enabled: boolean };
    const source = this.newsSourceStore.toggle(id, enabled);
    if (!source) {
      sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
      return;
    }
    sendSuccess(ws, frame.id, { source });
    this.broadcast("newsSource.updated", { source });
  }

  private async handleNewsSourceFetchNow(
    ws: WebSocket,
    frame: RequestFrame,
  ): Promise<void> {
    const { id } = frame.params as { id: string };
    const source = this.newsSourceStore.get(id);

    if (!source) {
      sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
      return;
    }

    // 即座に開始を返す
    sendSuccess(ws, frame.id, { status: "started" });

    // バックグラウンドでフェッチ実行
    this.executeNewsSourceFetch(source).catch((error) => {
      console.error(`[Gateway] NewsSource fetch failed for ${id}:`, error);
    });
  }

  private async executeNewsSourceFetch(
    source: NewsSourceDefinition,
  ): Promise<void> {
    console.log(`[Gateway] NewsSource fetch started for ${source.name}`);

    try {
      if (source.sourceType === "x-account") {
        const config = source.sourceConfig as XAccountConfig;
        const result = await fetchXAccount(config);
        const articles = result.tweets.map((tweet) => tweetToArticle(tweet));

        if (articles.length > 0) {
          await this.newsStore.save(articles);
          this.broadcast("news.updated", { articles: this.newsStore.list() });
        }

        console.log(
          `[Gateway] Fetched ${articles.length} articles from ${source.name}`,
        );
      }

      const updatedSource = this.newsSourceStore.updateLastFetchedAt(source.id);
      if (updatedSource) {
        this.broadcast("newsSource.updated", { source: updatedSource });
      }
    } catch (error) {
      console.error(`[Gateway] NewsSource fetch error:`, error);
      throw error;
    }
  }

  // ===== XPost Handlers =====

  private async handleXpostGenerate(
    ws: WebSocket,
    frame: RequestFrame,
  ): Promise<void> {
    const { articleId, options } = frame.params as {
      articleId: string;
      options?: XPostWorkflowOptions;
    };

    const article = this.newsStore.getById(articleId);
    if (!article) {
      sendError(ws, frame.id, "NOT_FOUND", `Article not found: ${articleId}`);
      return;
    }

    // 即座に「開始しました」を返す
    sendSuccess(ws, frame.id, { status: "started" });

    // バックグラウンドで実行、進捗はbroadcast
    this.xpostWorkflowService
      .execute(article, options ?? {}, (event: XPostProgressEvent) => {
        this.broadcast("xpost.progress", { articleId, ...event });
      })
      .then((result) => {
        this.broadcast("xpost.completed", result);
      })
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.broadcast("xpost.failed", { articleId, error: errorMessage });
      });
  }

  // ===== Discord Integration Methods =====

  async chatForDiscord(prompt: string): Promise<string> {
    const config = this.configManager.get();
    const provider = this.createLLMProvider(config.llm);

    const messages: Message[] = [{ role: "user", content: prompt }];
    const response = await provider.chat(messages, {
      systemPrompt: config.llm.systemPrompt,
    });

    return response;
  }

  async createPostForDiscord(
    platform: Platform,
    prompt: string,
  ): Promise<ApprovalItem> {
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

    // Broadcast to all WebSocket clients
    this.broadcast("post.created", { item });

    return item;
  }

  async approvePostForDiscord(
    id: string,
  ): Promise<{ success: boolean; item?: ApprovalItem | null; error?: string }> {
    const item = this.approvalQueue.approve(id);
    if (!item) {
      return { success: false, error: `Item not found: ${id}` };
    }

    if (item.platform !== "x") {
      return {
        success: false,
        error: `Platform not yet supported: ${item.platform}`,
      };
    }

    const xCreds = this.credentialStore.getXCredentials();
    let connector: XConnector;

    if (xCreds && !this.credentialStore.isXTokenExpired()) {
      connector = new XConnector({ oauth2AccessToken: xCreds.accessToken });
    } else if (this.xConnector) {
      connector = this.xConnector;
    } else {
      const failedItem = this.approvalQueue.markFailed(
        id,
        "X connector not configured",
      );
      this.broadcast("post.updated", { item: failedItem });
      return { success: false, error: "X connector not configured" };
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
        this.broadcast("post.updated", { item: postedItem });
        return { success: true, item: postedItem };
      } else {
        const failedItem = this.approvalQueue.markFailed(
          id,
          result.error ?? "Unknown error",
        );
        this.broadcast("post.updated", { item: failedItem });
        return { success: false, error: result.error ?? "Failed to post" };
      }
    } catch (error) {
      const failedItem = this.approvalQueue.markFailed(
        id,
        getErrorMessage(error),
      );
      this.broadcast("post.updated", { item: failedItem });
      return { success: false, error: getErrorMessage(error) };
    }
  }

  getStatusForDiscord(): {
    gateway: string;
    xAuth: string;
    discordBot: string;
    pendingPosts: number;
  } {
    const xCreds = this.credentialStore.getXCredentials();
    const xAuth = xCreds
      ? this.credentialStore.isXTokenExpired()
        ? "Expired"
        : `Connected (@${xCreds.username ?? "unknown"})`
      : "Not connected";

    return {
      gateway: "Running",
      xAuth,
      discordBot: this.isDiscordBotReady() ? "Connected" : "Not connected",
      pendingPosts: this.approvalQueue.list("pending").length,
    };
  }

  stop(): void {
    this.schedulerManager.stop();
    this.scheduleStore.close();
    this.newsSourceStore.close();
    this.wss.close();
    this.httpServer.close();
    this.sessionManager.close();
    this.configManager.close();
  }

  getServer(): Server {
    return this.httpServer;
  }
}
