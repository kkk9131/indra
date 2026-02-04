import type { Config, ConfigManager } from "../../../platform/config/index.js";
import type { ApprovalQueue } from "../../../platform/approval/index.js";
import type {
  CredentialStore,
  XOAuth2Handler,
} from "../../../platform/auth/index.js";
import type { XConnector } from "../../../integrations/index.js";
import type { DiscordBot } from "../../discord/index.js";
import type { LLMProvider } from "../../../orchestrator/llm/index.js";
import type { LogStore } from "../../../platform/logs/index.js";
import type {
  NewsScheduler,
  NewsSourceStore,
  NewsStore,
} from "../../../capabilities/content/news/index.js";
import type { AnalyticsScheduler } from "../../../orchestrator/analytics/index.js";
import type { SchedulerManager } from "../../../orchestrator/scheduler/index.js";
import type { RunRegistry } from "../../../orchestrator/agents/subagent/index.js";

import { createChatService, type ChatService } from "./chat.js";
import { createConfigService, type ConfigService } from "./config.js";
import { createPostService, type PostService } from "./post.js";
import { createAuthService, type AuthService } from "./auth.js";
import { createNewsService, type NewsService } from "./news.js";
import {
  createNewsSourceService,
  type NewsSourceService,
} from "./news-source.js";
import { createLogsService, type LogsService } from "./logs.js";
import { createAnalyticsService, type AnalyticsService } from "./analytics.js";
import { createScheduleService, type ScheduleService } from "./schedule.js";
import { createXpostService, type XpostService } from "./xpost.js";
import {
  createDiscordIntegrationService,
  type DiscordIntegrationService,
} from "./discord.js";
import { createSessionService, type SessionService } from "./session.js";
import { createMemoryService, type MemoryService } from "./memory.js";
import { EvaluationService } from "./evaluation.js";
import type {
  SessionManager,
  TranscriptManager,
} from "../../../platform/infra/index.js";
import type {
  MemoryStore,
  MemorySearch,
  MemoryIndexer,
} from "../../../platform/memory/index.js";
import { createReportsService, type ReportsService } from "./reports.js";
import { createDevlogService, type DevlogService } from "./devlog.js";

export type { EvaluationService } from "./evaluation.js";
export type { ReportsService, ReportSummary, ReportDetail } from "./reports.js";

export type { AgentLogParams } from "./chat.js";
export type { PostApproveResult } from "./post.js";
export type { AuthStartResult, AuthCallbackResult } from "./auth.js";
export type { AnalyticsRunResult } from "./analytics.js";
export type { NewsSourceFetchResult } from "./news-source.js";
export type { XpostGenerateResult } from "./xpost.js";
export type { MemoryService } from "./memory.js";

export interface GatewayServices {
  config: ConfigService;
  chat: ChatService;
  post: PostService;
  auth: AuthService;
  news: NewsService;
  newsSource: NewsSourceService;
  logs: LogsService;
  analytics: AnalyticsService;
  schedule: ScheduleService;
  xpost: XpostService;
  discordIntegration: DiscordIntegrationService;
  session: SessionService;
  memory: MemoryService | null;
  evaluation: EvaluationService;
  reports: ReportsService;
  devlog: DevlogService;
}

interface GatewayServiceDeps {
  configManager: ConfigManager;
  approvalQueue: ApprovalQueue;
  credentialStore: CredentialStore;
  xConnector: XConnector | null;
  xOAuth2Handler: XOAuth2Handler | null;
  discordBot: DiscordBot | null;
  isDiscordBotReady: () => boolean;
  newsStore: NewsStore;
  newsScheduler: NewsScheduler;
  newsSourceStore: NewsSourceStore;
  logStore: LogStore;
  analyticsScheduler: AnalyticsScheduler | null;
  schedulerManager: SchedulerManager;
  runRegistry: RunRegistry;
  sessionManager: SessionManager;
  transcriptManager: TranscriptManager;
  memoryStore: MemoryStore | null;
  memorySearch: MemorySearch | null;
  memoryIndexer: MemoryIndexer | null;
  createLLMProvider: (config: Config["llm"]) => LLMProvider;
  saveAgentLog: ChatService["saveAgentLog"];
  saveExecutionLog: ChatService["saveExecutionLog"];
  saveOutcomeLog: ChatService["saveOutcomeLog"];
  broadcast: (event: string, payload: unknown) => void;
}

export function createGatewayServices(
  deps: GatewayServiceDeps,
): GatewayServices {
  const config = createConfigService({ configManager: deps.configManager });
  const chat = createChatService({
    configManager: deps.configManager,
    createLLMProvider: deps.createLLMProvider,
    saveAgentLog: deps.saveAgentLog,
    saveExecutionLog: deps.saveExecutionLog,
    saveOutcomeLog: deps.saveOutcomeLog,
  });
  const post = createPostService({
    configManager: deps.configManager,
    approvalQueue: deps.approvalQueue,
    credentialStore: deps.credentialStore,
    xConnector: deps.xConnector,
    xOAuth2Handler: deps.xOAuth2Handler,
    createLLMProvider: deps.createLLMProvider,
  });
  const auth = createAuthService({
    credentialStore: deps.credentialStore,
    xOAuth2Handler: deps.xOAuth2Handler,
    xConnector: deps.xConnector,
    discordBot: deps.discordBot,
    isDiscordBotReady: deps.isDiscordBotReady,
  });
  const news = createNewsService({
    newsStore: deps.newsStore,
    newsScheduler: deps.newsScheduler,
  });
  const newsSource = createNewsSourceService({
    newsSourceStore: deps.newsSourceStore,
    newsStore: deps.newsStore,
  });
  const logs = createLogsService({
    logStore: deps.logStore,
  });
  const analytics = createAnalyticsService({
    analyticsScheduler: deps.analyticsScheduler,
  });
  const schedule = createScheduleService({
    schedulerManager: deps.schedulerManager,
  });
  const llmConfig = deps.configManager.get().llm;
  const xpost = createXpostService({
    newsStore: deps.newsStore,
    runRegistry: deps.runRegistry,
    llmProvider: deps.createLLMProvider(llmConfig),
  });
  const session = createSessionService({
    sessionManager: deps.sessionManager,
    transcriptManager: deps.transcriptManager,
  });

  const memory =
    deps.memoryStore && deps.memorySearch && deps.memoryIndexer
      ? createMemoryService({
          store: deps.memoryStore,
          search: deps.memorySearch,
          indexer: deps.memoryIndexer,
        })
      : null;

  const evaluation = new EvaluationService();

  const reports = createReportsService();

  const devlog = createDevlogService();

  return {
    config,
    chat,
    post,
    auth,
    news,
    newsSource,
    logs,
    analytics,
    schedule,
    xpost,
    session,
    memory,
    evaluation,
    reports,
    devlog,
    discordIntegration: createDiscordIntegrationService({
      chat,
      post,
      auth,
      broadcast: deps.broadcast,
    }),
  };
}
