export type SubagentStatus = "pending" | "running" | "completed" | "failed";

export interface ToolCallRecord {
  tool: string;
  input: unknown;
  output: unknown;
  timestamp: Date;
}

export interface SubagentRun {
  id: string;
  agentName: string;
  status: SubagentStatus;

  inputDigest: string;
  toolCalls: ToolCallRecord[];
  checkpoint: Record<string, unknown>;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  sessionId?: string;
  error?: string;
}

// X運用ドメイン型（後方互換のためre-export）
export type {
  XPostCheckpoint,
  GeneratedPost,
  PostEvaluationResult,
} from "../x-operations/types.js";

export interface SubagentRunSerialized {
  id: string;
  agentName: string;
  status: SubagentStatus;
  inputDigest: string;
  toolCalls: Array<{
    tool: string;
    input: unknown;
    output: unknown;
    timestamp: string;
  }>;
  checkpoint: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  sessionId?: string;
  error?: string;
}

export function serializeRun(run: SubagentRun): SubagentRunSerialized {
  return {
    ...run,
    toolCalls: run.toolCalls.map((tc) => ({
      ...tc,
      timestamp: tc.timestamp.toISOString(),
    })),
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString(),
    endedAt: run.endedAt?.toISOString(),
  };
}

export function deserializeRun(data: SubagentRunSerialized): SubagentRun {
  return {
    ...data,
    toolCalls: data.toolCalls.map((tc) => ({
      ...tc,
      timestamp: new Date(tc.timestamp),
    })),
    createdAt: new Date(data.createdAt),
    startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
    endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
  };
}
