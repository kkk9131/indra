import { z } from "zod";

/** Log types */
export type LogType = "agent" | "prompt" | "system";

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
}

/** LogEntry Zod schema */
export const LogEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["agent", "prompt", "system"]),
  timestamp: z.string(),
  sessionId: z.string().optional(),
  agentAction: z
    .enum(["text", "tool_start", "tool_result", "turn_complete", "done"])
    .optional(),
  tool: z.string().optional(),
  toolInput: z.any().optional(),
  toolResult: z.string().optional(),
  turnNumber: z.number().optional(),
  text: z.string().optional(),
  prompt: z.string().optional(),
  response: z.string().optional(),
  model: z.string().optional(),
  level: z.enum(["info", "warn", "error"]).optional(),
  message: z.string().optional(),
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
      type: "all" | "agent" | "prompt" | "system";
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
      type: z.enum(["all", "agent", "prompt", "system"]),
      sortOrder: z.enum(["newest", "oldest"]),
    }),
  }),
});
