import type { Config, ConfigManager } from "../../config/index.js";
import type { ApprovalQueue } from "../../approval/index.js";
import type { CredentialStore, XOAuth2Handler } from "../../auth/index.js";
import type { XConnector } from "../../connectors/index.js";
import type { DiscordBot } from "../../discord/index.js";
import type { LLMProvider } from "../../llm/index.js";
import type { LogStore, AgentActionType } from "../../logs/index.js";
import type {
  NewsScheduler,
  NewsSourceStore,
  NewsStore,
} from "../../news/index.js";
import type { AnalyticsScheduler } from "../../analytics/index.js";
import type { SchedulerManager } from "../../scheduler/index.js";
import type { XPostWorkflowService } from "../../xpost/index.js";

import {
  createChatService,
  type AgentLogParams,
  type ChatService,
} from "./chat.js";
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
import type { SessionManager, TranscriptManager } from "../../infra/index.js";
import type {
  MemoryStore,
  MemorySearch,
  MemoryIndexer,
} from "../../memory/index.js";

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
  memory: MemoryService;
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
  xpostWorkflowService: XPostWorkflowService;
  sessionManager: SessionManager;
  transcriptManager: TranscriptManager;
  memoryStore: MemoryStore | null;
  memorySearch: MemorySearch | null;
  memoryIndexer: MemoryIndexer | null;
  createLLMProvider: (config: Config["llm"]) => LLMProvider;
  saveAgentLog: (action: AgentActionType, params: AgentLogParams) => void;
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
  });
  const post = createPostService({
    configManager: deps.configManager,
    approvalQueue: deps.approvalQueue,
    credentialStore: deps.credentialStore,
    xConnector: deps.xConnector,
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
  const xpost = createXpostService({
    newsStore: deps.newsStore,
    xpostWorkflowService: deps.xpostWorkflowService,
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
    memory: memory!,
    discordIntegration: createDiscordIntegrationService({
      chat,
      post,
      auth,
      broadcast: deps.broadcast,
    }),
  };
}
