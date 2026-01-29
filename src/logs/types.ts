import { z } from "zod";

/** Log types */
export type LogType = "agent" | "prompt" | "system" | "execution" | "outcome";

/** Agent action types */
export type AgentActionType =
  | "text"
  | "tool_start"
  | "tool_result"
  | "turn_complete"
  | "done";

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
  type: z.enum(["agent", "prompt", "system", "execution", "outcome"]),
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
      ]),
      sortOrder: z.enum(["newest", "oldest"]),
    }),
  }),
});
