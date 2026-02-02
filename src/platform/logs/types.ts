import { z } from "zod";

/** Log types */
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

/** Agent action types */
export type AgentActionType =
  | "text"
  | "tool_start"
  | "tool_result"
  | "turn_complete"
  | "done";

/** Api method types */
export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** Approval action types */
export type ApprovalAction =
  | "create"
  | "approve"
  | "reject"
  | "schedule"
  | "post"
  | "fail";

/** Common error interface for all log types */
export interface LogError {
  code: string;
  message: string;
}

/** Approval content interface */
export interface ApprovalContent {
  text: string;
  preview?: string;
}

/** Scheduler action types */
export type SchedulerAction =
  | "execute"
  | "start"
  | "complete"
  | "skip"
  | "fail";

/** Browser action types */
export type BrowserAction =
  | "open"
  | "click"
  | "fill"
  | "screenshot"
  | "navigate"
  | "close";

/** Auth action types */
export type AuthAction = "login" | "logout" | "refresh" | "revoke" | "fail";

/** Memory action types */
export type MemoryAction = "index" | "search" | "save" | "delete" | "flush";

/** User action types */
export type UserAction = "command" | "chat" | "navigate" | "approve" | "reject";

/** Log entry interface */
export interface LogEntry {
  id: string;
  type: LogType;
  timestamp: string;
  sessionId?: string | null;
  // agent log
  agentAction?: AgentActionType | null;
  tool?: string | null;
  toolInput?: unknown | null;
  toolResult?: string | null;
  turnNumber?: number | null;
  text?: string | null;
  // prompt log
  prompt?: string | null;
  response?: string | null;
  model?: string | null;
  // system log
  level?: "info" | "warn" | "error" | null;
  message?: string | null;
  // execution log
  executionId?: string | null;
  executionAction?: ExecutionAction | null;
  executionConfig?: ExecutionConfig | null;
  input?: string | null;
  executionResult?: ExecutionResult | null;
  executionError?: ExecutionError | null;
  // outcome log
  outcomeId?: string | null;
  outcomeType?: OutcomeType | null;
  outcomeStage?: OutcomeStage | null;
  outcomeContent?: OutcomeContent | null;
  previousOutcomeId?: string | null;
  // api log
  apiService?: string | null;
  apiEndpoint?: string | null;
  apiMethod?: ApiMethod | null;
  apiRequestData?: unknown | null;
  apiResponseStatus?: number | null;
  apiResponseData?: unknown | null;
  apiDuration?: number | null;
  apiError?: LogError | null;
  // approval log
  approvalId?: string | null;
  approvalAction?: ApprovalAction | null;
  approvalPlatform?: string | null;
  approvalContent?: ApprovalContent | null;
  approvalBy?: string | null;
  approvalReason?: string | null;
  // scheduler log
  schedulerTaskId?: string | null;
  schedulerTaskType?: string | null;
  schedulerTaskName?: string | null;
  schedulerAction?: SchedulerAction | null;
  schedulerCronExpression?: string | null;
  schedulerDuration?: number | null;
  schedulerNextRunAt?: string | null;
  schedulerError?: LogError | null;
  // browser log
  browserAction?: BrowserAction | null;
  browserSession?: string | null;
  browserUrl?: string | null;
  browserSelector?: string | null;
  browserInput?: string | null;
  browserDuration?: number | null;
  browserError?: LogError | null;
  // auth log
  authAction?: AuthAction | null;
  authProvider?: string | null;
  authUserId?: string | null;
  authScopes?: string[] | null;
  authExpiresAt?: string | null;
  authError?: LogError | null;
  // memory log
  memoryAction?: MemoryAction | null;
  memoryFilePath?: string | null;
  memoryChunkCount?: number | null;
  memoryTokenCount?: number | null;
  memoryQuery?: string | null;
  memoryResultCount?: number | null;
  memoryDuration?: number | null;
  // user log
  userAction?: UserAction | null;
  userChannel?: string | null;
  userInput?: string | null;
  userCommand?: string | null;
  userResponse?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Execution action types */
export type ExecutionAction = "start" | "end" | "error";

/** Outcome types */
export type OutcomeType = "xpost" | "report" | "chat" | "file" | "other";

/** Outcome stage */
export type OutcomeStage = "draft" | "final";

/** Execution config for start action */
export interface ExecutionConfig {
  model: string;
  maxTurns: number;
  tools: string[];
  permissionMode: string;
  systemPromptHash?: string;
}

/** Execution result for end action */
export interface ExecutionResult {
  success: boolean;
  totalTurns: number;
  totalTokens: number;
  duration: number; // ms
}

/** Execution error info */
export interface ExecutionError {
  code: string;
  message: string;
}

/** XPost outcome content */
export interface OutcomeXPostContent {
  posts: Array<{
    text: string;
    hashtags: string[];
    score?: number;
  }>;
}

/** Report outcome content */
export interface OutcomeReportContent {
  title: string;
  summary: string;
}

/** Chat outcome content */
export interface OutcomeChatContent {
  finalResponse: string;
}

/** File outcome content */
export interface OutcomeFileContent {
  files: Array<{
    path: string;
    hash: string;
    size: number;
  }>;
}

/** Outcome content union */
export interface OutcomeContent {
  posts?: OutcomeXPostContent["posts"];
  report?: OutcomeReportContent;
  finalResponse?: string;
  files?: OutcomeFileContent["files"];
}

/** LogEntry Zod schema */
export const LogEntrySchema = z.object({
  id: z.string(),
  type: z.enum([
    "agent",
    "prompt",
    "system",
    "execution",
    "outcome",
    "api",
    "approval",
    "scheduler",
    "browser",
    "auth",
    "memory",
    "user",
  ]),
  timestamp: z.string(),
  sessionId: z.string().nullable().optional(),
  agentAction: z
    .enum(["text", "tool_start", "tool_result", "turn_complete", "done"])
    .nullable()
    .optional(),
  tool: z.string().nullable().optional(),
  toolInput: z.any().nullable().optional(),
  toolResult: z.string().nullable().optional(),
  turnNumber: z.number().nullable().optional(),
  text: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  response: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  level: z.enum(["info", "warn", "error"]).nullable().optional(),
  message: z.string().nullable().optional(),
  // execution log
  executionId: z.string().nullable().optional(),
  executionAction: z.enum(["start", "end", "error"]).nullable().optional(),
  executionConfig: z
    .object({
      model: z.string(),
      maxTurns: z.number(),
      tools: z.array(z.string()),
      permissionMode: z.string(),
      systemPromptHash: z.string().optional(),
    })
    .nullable()
    .optional(),
  input: z.string().nullable().optional(),
  executionResult: z
    .object({
      success: z.boolean(),
      totalTurns: z.number(),
      totalTokens: z.number(),
      duration: z.number(),
    })
    .nullable()
    .optional(),
  executionError: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable()
    .optional(),
  // outcome log
  outcomeId: z.string().nullable().optional(),
  outcomeType: z
    .enum(["xpost", "report", "chat", "file", "other"])
    .nullable()
    .optional(),
  outcomeStage: z.enum(["draft", "final"]).nullable().optional(),
  outcomeContent: z
    .object({
      posts: z
        .array(
          z.object({
            text: z.string(),
            hashtags: z.array(z.string()),
            score: z.number().optional(),
          }),
        )
        .optional(),
      report: z
        .object({
          title: z.string(),
          summary: z.string(),
        })
        .optional(),
      finalResponse: z.string().optional(),
      files: z
        .array(
          z.object({
            path: z.string(),
            hash: z.string(),
            size: z.number(),
          }),
        )
        .optional(),
    })
    .nullable()
    .optional(),
  previousOutcomeId: z.string().nullable().optional(),
  // api log
  apiService: z.string().nullable().optional(),
  apiEndpoint: z.string().nullable().optional(),
  apiMethod: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .nullable()
    .optional(),
  apiRequestData: z.any().nullable().optional(),
  apiResponseStatus: z.number().nullable().optional(),
  apiResponseData: z.any().nullable().optional(),
  apiDuration: z.number().nullable().optional(),
  apiError: z
    .object({ code: z.string(), message: z.string() })
    .nullable()
    .optional(),
  // approval log
  approvalId: z.string().nullable().optional(),
  approvalAction: z
    .enum(["create", "approve", "reject", "schedule", "post", "fail"])
    .nullable()
    .optional(),
  approvalPlatform: z.string().nullable().optional(),
  approvalContent: z
    .object({ text: z.string(), preview: z.string().optional() })
    .nullable()
    .optional(),
  approvalBy: z.string().nullable().optional(),
  approvalReason: z.string().nullable().optional(),
  // scheduler log
  schedulerTaskId: z.string().nullable().optional(),
  schedulerTaskType: z.string().nullable().optional(),
  schedulerTaskName: z.string().nullable().optional(),
  schedulerAction: z
    .enum(["execute", "start", "complete", "skip", "fail"])
    .nullable()
    .optional(),
  schedulerCronExpression: z.string().nullable().optional(),
  schedulerDuration: z.number().nullable().optional(),
  schedulerNextRunAt: z.string().nullable().optional(),
  schedulerError: z
    .object({ code: z.string(), message: z.string() })
    .nullable()
    .optional(),
  // browser log
  browserAction: z
    .enum(["open", "click", "fill", "screenshot", "navigate", "close"])
    .nullable()
    .optional(),
  browserSession: z.string().nullable().optional(),
  browserUrl: z.string().nullable().optional(),
  browserSelector: z.string().nullable().optional(),
  browserInput: z.string().nullable().optional(),
  browserDuration: z.number().nullable().optional(),
  browserError: z
    .object({ code: z.string(), message: z.string() })
    .nullable()
    .optional(),
  // auth log
  authAction: z
    .enum(["login", "logout", "refresh", "revoke", "fail"])
    .nullable()
    .optional(),
  authProvider: z.string().nullable().optional(),
  authUserId: z.string().nullable().optional(),
  authScopes: z.array(z.string()).nullable().optional(),
  authExpiresAt: z.string().nullable().optional(),
  authError: z
    .object({ code: z.string(), message: z.string() })
    .nullable()
    .optional(),
  // memory log
  memoryAction: z
    .enum(["index", "search", "save", "delete", "flush"])
    .nullable()
    .optional(),
  memoryFilePath: z.string().nullable().optional(),
  memoryChunkCount: z.number().nullable().optional(),
  memoryTokenCount: z.number().nullable().optional(),
  memoryQuery: z.string().nullable().optional(),
  memoryResultCount: z.number().nullable().optional(),
  memoryDuration: z.number().nullable().optional(),
  // user log
  userAction: z
    .enum(["command", "chat", "navigate", "approve", "reject"])
    .nullable()
    .optional(),
  userChannel: z.string().nullable().optional(),
  userInput: z.string().nullable().optional(),
  userCommand: z.string().nullable().optional(),
  userResponse: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

/** LogEntry array Zod schema */
export const LogEntriesSchema = z.array(LogEntrySchema);

/** Export format for copy functionality */
export interface LogExport {
  logs: LogEntry[];
  metadata: {
    exportedAt: string;
    totalCount: number;
    filters: {
      type: "all" | LogType;
      sortOrder: "newest" | "oldest";
    };
  };
}

export const LogExportSchema = z.object({
  logs: LogEntriesSchema,
  metadata: z.object({
    exportedAt: z.string(),
    totalCount: z.number(),
    filters: z.object({
      type: z.enum([
        "all",
        "agent",
        "prompt",
        "system",
        "execution",
        "outcome",
        "api",
        "approval",
        "scheduler",
        "browser",
        "auth",
        "memory",
        "user",
      ]),
      sortOrder: z.enum(["newest", "oldest"]),
    }),
  }),
});
