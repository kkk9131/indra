import { Hono } from "hono";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { createServer, type Server } from "http";
import { SessionManager, TranscriptManager } from "../../platform/infra/index.js";
import { ConfigManager, type Config } from "../../platform/config/index.js";
import { AgentSDKProvider, type LLMProvider } from "../../orchestrator/llm/index.js";
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
import {
  createGatewayServices,
  type AgentLogParams,
  type GatewayServices,
} from "./services/index.js";
import { ApprovalQueue } from "../../platform/approval/index.js";
import { XConnector, type Platform } from "../../integrations/index.js";
import { NewsStore, NewsScheduler, NewsSourceStore } from "../../capabilities/content/news/index.js";
import {
  XOAuth2Handler,
  getCredentialStore,
  type CredentialStore,
} from "../../platform/auth/index.js";
import { DiscordBot, commands as discordCommands } from "../discord/index.js";
import {
  LogStore,
  LogCollector,
  type AgentActionType,
  type ExecutionAction,
  type ExecutionConfig,
  type ExecutionResult,
  type ExecutionError,
  type OutcomeType,
  type OutcomeStage,
  type OutcomeContent,
  type LogEntry,
} from "../../platform/logs/index.js";
import type { ApprovalItem } from "../../platform/approval/types.js";
import {
  AnalyticsScheduler,
  NewsReportScheduler,
  createReportEmbed,
  createNewsReportEmbed,
  type DailyReport,
  type NewsReport,
} from "../../orchestrator/analytics/index.js";
import type { NewsArticle } from "../../capabilities/content/news/types.js";
import {
  SchedulerManager,
  ScheduleStore,
  TaskRegistry,
  TaskExecutor,
  PostScheduler,
  type TaskExecutionResult,
} from "../../orchestrator/scheduler/index.js";
import { XPostWorkflowService } from "../../capabilities/social/x/index.js";
import {
  MemoryStore,
  MemorySearch,
  MemoryIndexer,
  createEmbeddingProvider,
  ensureMemoryFiles,
} from "../../platform/memory/index.js";
import {
  EvaluationStore,
  AutoEvaluator,
  type EvaluationHook,
  type OutcomeLogEntry,
} from "../../orchestrator/evaluation/index.js";

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
  private transcriptManager: TranscriptManager;
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
  private newsReportScheduler: NewsReportScheduler | null = null;
  private schedulerManager: SchedulerManager;
  private scheduleStore: ScheduleStore;
  private taskRegistry: TaskRegistry;
  private taskExecutor: TaskExecutor;
  private xpostWorkflowService: XPostWorkflowService;
  private postScheduler: PostScheduler;
  private memoryStore: MemoryStore | null = null;
  private memorySearch: MemorySearch | null = null;
  private memoryIndexer: MemoryIndexer | null = null;
  private evaluationStore: EvaluationStore;
  private evaluationHooks: EvaluationHook[] = [];
  private services: GatewayServices;
  private requestHandlers: Map<string, RequestHandler>;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port = 3001) {
    this.port = port;
    this.app = new Hono();
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.sessionManager = new SessionManager();
    this.transcriptManager = new TranscriptManager();
    this.configManager = new ConfigManager();
    this.approvalQueue = new ApprovalQueue();
    this.credentialStore = getCredentialStore();

    this.newsStore = new NewsStore();
    this.newsSourceStore = new NewsSourceStore();
    this.newsScheduler = new NewsScheduler(this.newsStore, (articles) => {
      this.broadcast("news.updated", { articles });
    });

    this.postScheduler = new PostScheduler(
      this.approvalQueue,
      this.credentialStore,
      (item) => this.broadcast("post.updated", { item }),
    );

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

    this.evaluationStore = new EvaluationStore();
    this.initEvaluationHooks();

    this.initMemory();
    this.setupRoutes();
    this.setupWebSocket();
    this.initConnectors();
    this.initOAuth2();
    this.initDiscordBot();
    this.initAnalytics();
    this.initScheduledTasks();
    this.services = createGatewayServices({
      configManager: this.configManager,
      approvalQueue: this.approvalQueue,
      credentialStore: this.credentialStore,
      xConnector: this.xConnector,
      xOAuth2Handler: this.xOAuth2Handler,
      discordBot: this.discordBot,
      isDiscordBotReady: () => this.isDiscordBotReady(),
      newsStore: this.newsStore,
      newsScheduler: this.newsScheduler,
      newsSourceStore: this.newsSourceStore,
      logStore: this.logStore,
      analyticsScheduler: this.analyticsScheduler,
      schedulerManager: this.schedulerManager,
      xpostWorkflowService: this.xpostWorkflowService,
      sessionManager: this.sessionManager,
      transcriptManager: this.transcriptManager,
      memoryStore: this.memoryStore,
      memorySearch: this.memorySearch,
      memoryIndexer: this.memoryIndexer,
      createLLMProvider: (config) => this.createLLMProvider(config),
      saveAgentLog: (action, params) => this.saveAgentLog(action, params),
      saveExecutionLog: (executionId, action, params) =>
        this.saveExecutionLog(executionId, action, params),
      saveOutcomeLog: (...args) => this.saveOutcomeLog(...args),
      broadcast: (event, payload) => this.broadcast(event, payload),
    });
    this.requestHandlers = createHandlerRegistry(this.buildHandlerContext());
  }

  private initEvaluationHooks(): void {
    this.registerEvaluationHook(new AutoEvaluator(this.evaluationStore));
    console.log("EvaluationHooks: AutoEvaluator registered");
  }

  registerEvaluationHook(hook: EvaluationHook): void {
    this.evaluationHooks.push(hook);
  }

  private fireEvaluationHooks(outcomeLog: OutcomeLogEntry): void {
    for (const hook of this.evaluationHooks) {
      hook
        .onOutcomeSaved(outcomeLog)
        .catch((err) => console.error("EvaluationHook error:", err));
    }
  }

  private initMemory(): void {
    try {
      // MEMORY.md と memory/ ディレクトリが存在しなければ作成
      ensureMemoryFiles().catch((err) =>
        console.error("Failed to ensure memory files:", err),
      );

      this.memoryStore = new MemoryStore();
      const embeddingProvider = createEmbeddingProvider();
      this.memorySearch = new MemorySearch(this.memoryStore, embeddingProvider);
      this.memoryIndexer = new MemoryIndexer(
        this.memoryStore,
        embeddingProvider,
      );
      console.log(
        `MemoryStore: Initialized (vector: ${this.memoryStore.isVectorEnabled()})`,
      );
    } catch (error) {
      console.error("Failed to initialize memory:", error);
      this.memoryStore = null;
      this.memorySearch = null;
      this.memoryIndexer = null;
    }
  }

  private initAnalytics(): void {
    // ZAI_API_KEY がない場合はスキップ
    console.log(
      "initAnalytics: ZAI_API_KEY =",
      process.env.ZAI_API_KEY ? "set" : "not set",
    );
    console.log(
      "initAnalytics: DISCORD_REPORT_CHANNEL_ID =",
      process.env.DISCORD_REPORT_CHANNEL_ID ?? "not set",
    );
    console.log(
      "initAnalytics: DISCORD_GENERAL_CHANNEL_ID =",
      process.env.DISCORD_GENERAL_CHANNEL_ID ?? "not set",
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

    // NewsReportSchedulerの初期化
    try {
      this.newsReportScheduler = new NewsReportScheduler(
        this.newsStore,
        this.approvalQueue,
        (report, article) => this.handleNewsReportGenerated(report, article),
      );
      console.log("NewsReportScheduler: Initialized successfully");
    } catch (error) {
      console.error("Failed to initialize news report scheduler:", error);
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

    if (this.newsReportScheduler) {
      this.schedulerManager.registerTaskType({
        type: "news-report",
        name: "ニュースレポート",
        description: "ニュース/投稿の評価Top3レポートを生成",
        execute: () => this.newsReportScheduler!.run().then(() => {}),
        defaultCron: "0 6 * * *",
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

    if (this.newsReportScheduler) {
      this.schedulerManager.ensureDefaultTask(
        "news-report",
        "ニュースレポート",
        "毎朝6時にニュース/投稿の評価Top3レポートを生成",
        "0 6 * * *",
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

    // 4. LogStoreに記録
    this.saveOutcomeLog(report.id, "analytics-scheduler", "report", "final", {
      report: {
        title: report.title,
        summary: report.summary,
      },
    });
  }

  private async handleNewsReportGenerated(
    report: NewsReport,
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
      const embed = createNewsReportEmbed(report);
      const result = await this.discordBot.sendEmbed(channelId, embed);
      if (!result.success) {
        console.error("Failed to send news report to Discord:", result.error);
      }
    }

    // 4. LogStoreに記録
    this.saveOutcomeLog(report.id, "news-report-scheduler", "report", "final", {
      report: {
        title: report.title,
        summary: report.summary,
      },
    });
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

  /** Helper to save execution logs */
  private saveExecutionLog(
    executionId: string,
    action: ExecutionAction,
    params: {
      config?: ExecutionConfig;
      input?: string;
      result?: ExecutionResult;
      error?: ExecutionError;
    },
  ): void {
    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      type: "execution",
      timestamp: new Date().toISOString(),
      sessionId: this.logCollector.getSessionId(),
      executionId,
      executionAction: action,
      executionConfig: params.config ?? null,
      input: params.input ?? null,
      executionResult: params.result ?? null,
      executionError: params.error ?? null,
    };
    this.logStore.save(logEntry);
    this.broadcast("logs.updated", { log: logEntry });
  }

  /** Helper to save outcome logs */
  private saveOutcomeLog(
    outcomeId: string,
    executionId: string,
    outcomeType: OutcomeType,
    stage: OutcomeStage,
    content: OutcomeContent,
  ): void {
    const sessionId = this.logCollector.getSessionId();
    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      type: "outcome",
      timestamp: new Date().toISOString(),
      sessionId,
      outcomeId,
      executionId,
      outcomeType,
      outcomeStage: stage,
      outcomeContent: content,
    };
    this.logStore.save(logEntry);
    this.broadcast("logs.updated", { log: logEntry });

    this.fireEvaluationHooks({
      id: logEntry.id,
      outcomeId,
      executionId,
      sessionId,
      outcomeType,
      outcomeStage: stage,
      content,
    });
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
      services: this.services,
      broadcast: (event, payload) => this.broadcast(event, payload),
      sendSuccess,
      sendError,
      getErrorMessage,
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

        // 予約投稿スケジューラーを開始
        this.postScheduler.start();

        resolve();
      });
    });
  }

  // ===== Discord Integration Methods =====

  async chatForDiscord(prompt: string): Promise<string> {
    return this.services.discordIntegration.chat(prompt);
  }

  async createPostForDiscord(
    platform: Platform,
    prompt: string,
  ): Promise<ApprovalItem> {
    return this.services.discordIntegration.createPost(platform, prompt);
  }

  async approvePostForDiscord(
    id: string,
  ): Promise<{ success: boolean; item?: ApprovalItem | null; error?: string }> {
    return this.services.discordIntegration.approvePost(id);
  }

  getStatusForDiscord(): {
    gateway: string;
    xAuth: string;
    discordBot: string;
    pendingPosts: number;
  } {
    return this.services.discordIntegration.getStatus();
  }

  stop(): void {
    this.postScheduler.stop();
    this.schedulerManager.stop();
    this.scheduleStore.close();
    this.newsSourceStore.close();
    this.memoryStore?.close();
    this.evaluationStore.close();
    this.wss.close();
    this.httpServer.close();
    this.sessionManager.close();
    this.configManager.close();
  }

  getServer(): Server {
    return this.httpServer;
  }
}
