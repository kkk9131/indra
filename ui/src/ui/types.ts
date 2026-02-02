// Phase 3 UI Types
import type { ApprovalItem } from "../services/ws-client.js";

export type Platform =
  | "x"
  | "note"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "other";

export type ContentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "posted"
  | "scheduled";

export interface Content {
  id: string;
  platform: Platform;
  accountId: string;
  text: string;
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
  scheduledAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Convert backend ApprovalItem to UI Content
 */
export function approvalItemToContent(item: ApprovalItem): Content {
  return {
    id: item.id,
    platform: item.platform as Platform,
    accountId: "default", // Backend doesn't track accountId yet
    text: item.content.text,
    status: item.status as ContentStatus,
    createdAt: new Date(item.createdAt).getTime(),
    updatedAt: new Date(item.updatedAt).getTime(),
    scheduledAt: item.scheduledAt
      ? new Date(item.scheduledAt).getTime()
      : undefined,
    metadata: {
      prompt: item.prompt,
      postId: item.postId,
      postUrl: item.postUrl,
      error: item.error,
    },
  };
}

/**
 * Convert UI Content to backend Content format
 */
export function contentToApprovalContent(content: Content): { text: string } {
  return {
    text: content.text,
  };
}

export interface Account {
  id: string;
  platform: Platform;
  accountName: string;
  displayName?: string;
  status: "active" | "expired" | "error";
  contentCount: number;
  lastPostedAt?: number;
}

export interface ApiToken {
  id: string;
  name: string;
  token: string;
  isActive: boolean;
  lastUsedAt?: number;
  createdAt: number;
}

export type { NewsArticle } from "../services/ws-client.js";
export type NewsSource =
  | "claude-code"
  | "blog"
  | "indra-log"
  | "news-report"
  | "x-account"
  | "github-changelog";

// Log types - these mirror the backend types in src/platform/logs/types.ts
// Keeping separate to avoid cross-package dependencies

export type LogType =
  | "agent"
  | "prompt"
  | "system"
  | "execution"
  | "outcome"
  | "api"
  | "approval"
  | "scheduler"
  | "browser"
  | "auth"
  | "memory"
  | "user";

export type AgentActionType =
  | "text"
  | "tool_start"
  | "tool_result"
  | "turn_complete"
  | "done";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type ApprovalAction =
  | "create"
  | "approve"
  | "reject"
  | "schedule"
  | "post"
  | "fail";

export type SchedulerAction =
  | "execute"
  | "start"
  | "complete"
  | "skip"
  | "fail";

export type BrowserAction =
  | "open"
  | "click"
  | "fill"
  | "screenshot"
  | "navigate"
  | "close";

export type AuthAction = "login" | "logout" | "refresh" | "revoke" | "fail";

export type MemoryAction = "index" | "search" | "save" | "delete" | "flush";

export type UserAction = "command" | "chat" | "navigate" | "approve" | "reject";

/** Common error interface */
export interface LogError {
  code: string;
  message: string;
}

export interface LogEntry {
  id: string;
  type: LogType;
  timestamp: string;
  sessionId?: string;
  // agent log
  agentAction?: AgentActionType;
  tool?: string;
  toolInput?: unknown;
  toolResult?: string;
  turnNumber?: number;
  text?: string;
  // prompt log
  prompt?: string;
  response?: string;
  model?: string;
  // system log
  level?: "info" | "warn" | "error";
  message?: string;
  // execution log
  executionId?: string;
  executionAction?: "start" | "end" | "error";
  executionConfig?: {
    model: string;
    maxTurns: number;
    tools: string[];
    permissionMode: string;
  };
  input?: string;
  executionResult?: {
    success: boolean;
    totalTurns: number;
    totalTokens: number;
    duration: number;
  };
  executionError?: LogError;
  // outcome log
  outcomeId?: string;
  outcomeType?: "xpost" | "report" | "chat" | "file" | "other";
  outcomeStage?: "draft" | "final";
  outcomeContent?: {
    posts?: Array<{ text: string; hashtags: string[]; score?: number }>;
    report?: { title: string; summary: string };
    finalResponse?: string;
    files?: Array<{ path: string; hash: string; size: number }>;
  };
  previousOutcomeId?: string;
  // api log
  apiService?: string;
  apiEndpoint?: string;
  apiMethod?: ApiMethod;
  apiRequestData?: unknown;
  apiResponseStatus?: number;
  apiResponseData?: unknown;
  apiDuration?: number;
  apiError?: LogError;
  // approval log
  approvalId?: string;
  approvalAction?: ApprovalAction;
  approvalPlatform?: string;
  approvalContent?: { text: string; preview?: string };
  approvalBy?: string;
  approvalReason?: string;
  // scheduler log
  schedulerTaskId?: string;
  schedulerTaskType?: string;
  schedulerTaskName?: string;
  schedulerAction?: SchedulerAction;
  schedulerCronExpression?: string;
  schedulerDuration?: number;
  schedulerNextRunAt?: string;
  schedulerError?: LogError;
  // browser log
  browserAction?: BrowserAction;
  browserSession?: string;
  browserUrl?: string;
  browserSelector?: string;
  browserInput?: string;
  browserDuration?: number;
  browserError?: LogError;
  // auth log
  authAction?: AuthAction;
  authProvider?: string;
  authUserId?: string;
  authScopes?: string[];
  authExpiresAt?: string;
  authError?: LogError;
  // memory log
  memoryAction?: MemoryAction;
  memoryFilePath?: string;
  memoryChunkCount?: number;
  memoryTokenCount?: number;
  memoryQuery?: string;
  memoryResultCount?: number;
  memoryDuration?: number;
  // user log
  userAction?: UserAction;
  userChannel?: string;
  userInput?: string;
  userCommand?: string;
  userResponse?: string;
  metadata?: Record<string, unknown>;
}

export type LogSortOrder = "newest" | "oldest";

/** Format a log entry for JSON export */
export function formatLogForExport(log: LogEntry): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: log.type,
    timestamp: log.timestamp,
  };

  switch (log.type) {
    case "agent":
      base.action = log.agentAction;
      if (log.tool) base.tool = log.tool;
      if (log.toolInput) base.input = log.toolInput;
      if (log.toolResult) base.result = log.toolResult;
      if (log.text) base.text = log.text;
      if (log.sessionId) base.session = log.sessionId;
      if (log.turnNumber !== undefined) base.turn = log.turnNumber;
      break;
    case "prompt":
      if (log.prompt) base.prompt = log.prompt;
      if (log.response) base.response = log.response;
      if (log.model) base.model = log.model;
      break;
    case "system":
      if (log.level) base.level = log.level;
      if (log.message) base.message = log.message;
      break;
    case "execution":
      if (log.executionId) base.executionId = log.executionId;
      if (log.executionAction) base.action = log.executionAction;
      if (log.executionConfig) base.config = log.executionConfig;
      if (log.input) base.input = log.input;
      if (log.executionResult) base.result = log.executionResult;
      if (log.executionError) base.error = log.executionError;
      if (log.sessionId) base.session = log.sessionId;
      break;
    case "outcome":
      if (log.outcomeId) base.outcomeId = log.outcomeId;
      if (log.outcomeType) base.outcomeType = log.outcomeType;
      if (log.outcomeStage) base.stage = log.outcomeStage;
      if (log.outcomeContent) base.content = log.outcomeContent;
      if (log.previousOutcomeId) base.previousOutcomeId = log.previousOutcomeId;
      if (log.metadata) base.metadata = log.metadata;
      if (log.sessionId) base.session = log.sessionId;
      break;
    case "api":
      if (log.apiService) base.service = log.apiService;
      if (log.apiEndpoint) base.endpoint = log.apiEndpoint;
      if (log.apiMethod) base.method = log.apiMethod;
      if (log.apiRequestData) base.request = log.apiRequestData;
      if (log.apiResponseStatus) base.status = log.apiResponseStatus;
      if (log.apiResponseData) base.response = log.apiResponseData;
      if (log.apiDuration) base.duration = log.apiDuration;
      if (log.apiError) base.error = log.apiError;
      break;
    case "approval":
      if (log.approvalId) base.approvalId = log.approvalId;
      if (log.approvalAction) base.action = log.approvalAction;
      if (log.approvalPlatform) base.platform = log.approvalPlatform;
      if (log.approvalContent) base.content = log.approvalContent;
      if (log.approvalBy) base.approvedBy = log.approvalBy;
      if (log.approvalReason) base.reason = log.approvalReason;
      break;
    case "scheduler":
      if (log.schedulerTaskId) base.taskId = log.schedulerTaskId;
      if (log.schedulerTaskType) base.taskType = log.schedulerTaskType;
      if (log.schedulerTaskName) base.taskName = log.schedulerTaskName;
      if (log.schedulerAction) base.action = log.schedulerAction;
      if (log.schedulerCronExpression) base.cron = log.schedulerCronExpression;
      if (log.schedulerDuration) base.duration = log.schedulerDuration;
      if (log.schedulerNextRunAt) base.nextRunAt = log.schedulerNextRunAt;
      if (log.schedulerError) base.error = log.schedulerError;
      break;
    case "browser":
      if (log.browserAction) base.action = log.browserAction;
      if (log.browserSession) base.session = log.browserSession;
      if (log.browserUrl) base.url = log.browserUrl;
      if (log.browserSelector) base.selector = log.browserSelector;
      if (log.browserInput) base.input = log.browserInput;
      if (log.browserDuration) base.duration = log.browserDuration;
      if (log.browserError) base.error = log.browserError;
      break;
    case "auth":
      if (log.authAction) base.action = log.authAction;
      if (log.authProvider) base.provider = log.authProvider;
      if (log.authUserId) base.userId = log.authUserId;
      if (log.authScopes) base.scopes = log.authScopes;
      if (log.authExpiresAt) base.expiresAt = log.authExpiresAt;
      if (log.authError) base.error = log.authError;
      break;
    case "memory":
      if (log.memoryAction) base.action = log.memoryAction;
      if (log.memoryFilePath) base.filePath = log.memoryFilePath;
      if (log.memoryChunkCount) base.chunkCount = log.memoryChunkCount;
      if (log.memoryTokenCount) base.tokenCount = log.memoryTokenCount;
      if (log.memoryQuery) base.query = log.memoryQuery;
      if (log.memoryResultCount) base.resultCount = log.memoryResultCount;
      if (log.memoryDuration) base.duration = log.memoryDuration;
      break;
    case "user":
      if (log.userAction) base.action = log.userAction;
      if (log.userChannel) base.channel = log.userChannel;
      if (log.userInput) base.input = log.userInput;
      if (log.userCommand) base.command = log.userCommand;
      if (log.userResponse) base.response = log.userResponse;
      break;
  }

  return base;
}

// Devlog types
export interface CommitInfo {
  hash: string;
  message: string;
  type: string;
  scope?: string;
  timestamp: string;
  author: string;
  files: string[];
}

export interface DevlogEntry {
  id: string;
  date: string;
  commits: CommitInfo[];
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
    totalCommits: number;
  };
}
