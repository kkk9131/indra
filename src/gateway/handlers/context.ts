import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { ApprovalQueue } from "../../approval/index.js";
import type { CredentialStore, XOAuth2Handler } from "../../auth/index.js";
import type { Config, ConfigManager } from "../../config/index.js";
import type { XConnector } from "../../connectors/index.js";
import type { DiscordBot } from "../../discord/index.js";
import type { LLMProvider } from "../../llm/index.js";
import type { LogStore } from "../../logs/index.js";
import type { NewsScheduler, NewsSourceStore, NewsStore } from "../../news/index.js";
import type { AnalyticsScheduler } from "../../analytics/index.js";
import type { SchedulerManager } from "../../scheduler/index.js";
import type { XPostWorkflowService } from "../../xpost/index.js";

export type RequestHandler = (
  ws: WebSocket,
  frame: RequestFrame,
) => Promise<void> | void;

export interface GatewayHandlers {
  handleChatSend: RequestHandler;
  handleChatCancel: RequestHandler;
  handleLLMTest: RequestHandler;
}

export interface GatewayContext {
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
  createLLMProvider: (config: Config["llm"]) => LLMProvider;
  broadcast: (event: string, payload: unknown) => void;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
  handlers: GatewayHandlers;
}
