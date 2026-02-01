/**
 * RunRegistry - 実行状態追跡
 *
 * SubagentRunの作成・更新・取得を担当
 */

import { createHash } from "node:crypto";
import type { SubagentRun, SubagentStatus, ToolCallRecord } from "./types.js";
import { CheckpointStore, defaultCheckpointStore } from "./checkpoint.js";

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function computeInputDigest(input: unknown): string {
  const json = JSON.stringify(input);
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

export class RunRegistry {
  private runs = new Map<string, SubagentRun>();

  constructor(
    private checkpointStore: CheckpointStore = defaultCheckpointStore,
  ) {}

  /**
   * 実行開始を記録
   */
  async start(agentName: string, input: unknown): Promise<SubagentRun> {
    const run: SubagentRun = {
      id: generateRunId(),
      agentName,
      status: "running",
      inputDigest: computeInputDigest(input),
      toolCalls: [],
      checkpoint: {},
      createdAt: new Date(),
      startedAt: new Date(),
    };

    this.runs.set(run.id, run);
    await this.checkpointStore.save(run);

    return run;
  }

  /**
   * ツール実行を記録
   */
  async recordToolCall(
    runId: string,
    tool: string,
    input: unknown,
    output: unknown,
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const record: ToolCallRecord = {
      tool,
      input,
      output,
      timestamp: new Date(),
    };

    run.toolCalls.push(record);
    await this.checkpointStore.save(run);
  }

  /**
   * チェックポイント更新
   */
  async updateCheckpoint(
    runId: string,
    checkpoint: Record<string, unknown>,
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.checkpoint = { ...run.checkpoint, ...checkpoint };
    await this.checkpointStore.save(run);
  }

  /**
   * ステータス更新
   */
  async updateStatus(runId: string, status: SubagentStatus): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.status = status;
    if (status === "completed" || status === "failed") {
      run.endedAt = new Date();
    }
    await this.checkpointStore.save(run);
  }

  /**
   * 完了を記録
   */
  async complete(runId: string, result?: unknown): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.status = "completed";
    run.endedAt = new Date();
    if (result !== undefined) {
      run.checkpoint = { ...run.checkpoint, result };
    }
    await this.checkpointStore.save(run);
  }

  /**
   * 失敗を記録
   */
  async fail(runId: string, error: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.status = "failed";
    run.endedAt = new Date();
    run.error = error;
    await this.checkpointStore.save(run);
  }

  /**
   * SDK sessionIdを設定
   */
  async setSessionId(runId: string, sessionId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.sessionId = sessionId;
    await this.checkpointStore.save(run);
  }

  /**
   * 実行を取得
   */
  get(runId: string): SubagentRun | undefined {
    return this.runs.get(runId);
  }

  /**
   * エージェント名で取得
   */
  async getByAgent(agentName: string): Promise<SubagentRun[]> {
    const all = await this.checkpointStore.listAll();
    return all.filter((run) => run.agentName === agentName);
  }

  /**
   * 未完了の実行を取得（復旧用）
   */
  async getPending(): Promise<SubagentRun[]> {
    const all = await this.checkpointStore.listAll();
    return all.filter(
      (run) => run.status === "pending" || run.status === "running",
    );
  }

  /**
   * 永続化ストアから読み込んでメモリにキャッシュ
   */
  async loadFromStore(): Promise<void> {
    const all = await this.checkpointStore.listAll();
    for (const run of all) {
      this.runs.set(run.id, run);
    }
  }

  /**
   * 実行を削除
   */
  async delete(runId: string): Promise<void> {
    this.runs.delete(runId);
    await this.checkpointStore.delete(runId);
  }

  /**
   * 全実行をクリア（テスト用）
   */
  clear(): void {
    this.runs.clear();
  }
}

export const runRegistry = new RunRegistry();
