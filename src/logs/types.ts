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
}

/** LogEntry Zod schema */
export const LogEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["agent", "prompt", "system"]),
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
