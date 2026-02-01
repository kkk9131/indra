/**
 * SubagentRegistry型定義
 *
 * SDKの`resume`機能は「会話コンテキストの復元」であり「タスク状態の復元」ではない。
 * この混同を避けるため、SubagentRegistryで実行状態を管理する。
 */

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

  /** 入力のダイジェスト（再実行判定用） */
  inputDigest: string;

  /** ツール実行記録 */
  toolCalls: ToolCallRecord[];

  /** チェックポイント状態（タスク固有） */
  checkpoint: Record<string, unknown>;

  /** タイムスタンプ */
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;

  /** 復旧用 */
  sessionId?: string; // SDK sessionId（補助的）
  error?: string;
}

/** X運用のチェックポイント */
export interface XPostCheckpoint {
  articleId: string;
  phase: "analyzing" | "generating" | "evaluating" | "refining" | "completed";
  generatedPosts?: GeneratedPost[];
  bestPostId?: string;
  /** 投稿済みID（二重投稿防止） */
  publishedPostIds?: string[];
  refinementCount: number;
}

export interface GeneratedPost {
  id: string;
  content: string;
  score?: number;
  evaluationResult?: PostEvaluationResult;
}

export interface PostEvaluationResult {
  totalScore: number;
  replyScore: number;
  engagementScore: number;
  dwellTimeScore: number;
  qualityScore: number;
  suggestions: string[];
}

/** シリアライズ用の型（Date → string変換） */
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
