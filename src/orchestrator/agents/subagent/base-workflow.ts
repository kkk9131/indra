/**
 * BaseWorkflow - ワークフロー共通基底クラス
 *
 * 共通ライフサイクル（start → run → complete/fail）、
 * リトライ（指数バックオフ）、復旧を提供する。
 * 各ドメインは run() を実装するだけで良い。
 */

import type { RunRegistry } from "./run-registry.js";
import type {
  LLMProvider,
  AgentEvent,
  AgentChatOptions,
  Message,
  TokenUsage,
} from "../../llm/index.js";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: Array<string | RegExp>;
}

export interface WorkflowLifecycleHooks {
  onStart?: (runId: string, agentName: string) => void | Promise<void>;
  onComplete?: (runId: string, agentName: string) => void | Promise<void>;
  onFail?: (
    runId: string,
    agentName: string,
    error: string,
  ) => void | Promise<void>;
  onRetry?: (
    runId: string,
    agentName: string,
    attempt: number,
    error: string,
  ) => void | Promise<void>;
}

interface AgentDef {
  prompt: string;
  tools?: string[];
  allowedSkills?: string[];
}

const DEFAULT_RETRY: Required<Omit<RetryOptions, "retryableErrors">> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryable(
  error: unknown,
  patterns?: Array<string | RegExp>,
): boolean {
  if (!patterns || patterns.length === 0) return true;
  const message = toErrorMessage(error);
  return patterns.some((p) =>
    typeof p === "string" ? message.includes(p) : p.test(message),
  );
}

export abstract class BaseWorkflow<TInput, TOutput, TCheckpoint> {
  protected llmProvider: LLMProvider | null = null;
  protected lifecycleHooks: WorkflowLifecycleHooks = {};

  constructor(protected registry: RunRegistry) {}

  /** LLMプロバイダーを設定 */
  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  /** ライフサイクルフックを設定 */
  setLifecycleHooks(hooks: WorkflowLifecycleHooks): void {
    this.lifecycleHooks = hooks;
  }

  /** エージェント名（サブクラスで定義） */
  protected abstract get agentName(): string;

  /** 初期チェックポイント生成（サブクラスで定義） */
  protected abstract initCheckpoint(input: TInput): TCheckpoint;

  /** ドメイン固有のワークフロー実行（サブクラスで実装） */
  protected abstract run(runId: string, input: TInput): Promise<TOutput>;

  /**
   * ワークフロー実行（テンプレートメソッド）
   *
   * start → initCheckpoint → run() → complete/fail
   */
  async execute(input: TInput): Promise<TOutput> {
    const run = await this.registry.start(this.agentName, input);
    const runId = run.id;

    console.log(`[${this.agentName}] Run started: ${runId}`);
    await this.lifecycleHooks.onStart?.(runId, this.agentName);

    const checkpoint = this.initCheckpoint(input);
    await this.registry.updateCheckpoint(
      runId,
      checkpoint as unknown as Record<string, unknown>,
    );

    try {
      const result = await this.run(runId, input);

      await this.registry.complete(runId, result);
      console.log(`[${this.agentName}] Run completed: ${runId}`);
      await this.lifecycleHooks.onComplete?.(runId, this.agentName);

      return result;
    } catch (error) {
      const message = toErrorMessage(error);

      await this.registry.fail(runId, message);
      console.error(`[${this.agentName}] Run failed: ${runId} - ${message}`);
      await this.lifecycleHooks.onFail?.(runId, this.agentName, message);

      throw error;
    }
  }

  /**
   * リトライ付き実行
   *
   * ワークフロー全体を最初からリトライする。
   * 失敗した run は failed として記録し、新しい run を開始する。
   */
  async executeWithRetry(
    input: TInput,
    options?: RetryOptions,
  ): Promise<TOutput> {
    const maxRetries = options?.maxRetries ?? DEFAULT_RETRY.maxRetries;
    const initialDelayMs =
      options?.initialDelayMs ?? DEFAULT_RETRY.initialDelayMs;
    const backoffMultiplier =
      options?.backoffMultiplier ?? DEFAULT_RETRY.backoffMultiplier;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(input);
      } catch (error) {
        lastError = error;

        if (attempt >= maxRetries) break;
        if (!isRetryable(error, options?.retryableErrors)) break;

        const delay = initialDelayMs * backoffMultiplier ** attempt;
        const message = toErrorMessage(error);

        console.log(
          `[${this.agentName}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${message}`,
        );
        await this.lifecycleHooks.onRetry?.(
          "",
          this.agentName,
          attempt + 1,
          message,
        );

        await sleep(delay);
      }
    }

    throw lastError;
  }

  /** チェックポイントのphaseフィールドを更新 */
  protected async updatePhase(runId: string, phase: string): Promise<void> {
    await this.registry.updateCheckpoint(runId, { phase });
  }

  /**
   * LLMプロバイダーが利用可能か確認
   *
   * @throws chatStreamWithAgent 未設定時にエラー
   */
  protected ensureLLMProvider(): LLMProvider & {
    chatStreamWithAgent: NonNullable<LLMProvider["chatStreamWithAgent"]>;
  } {
    if (!this.llmProvider?.chatStreamWithAgent) {
      throw new Error("LLM provider with agent support not configured");
    }
    return this.llmProvider as LLMProvider & {
      chatStreamWithAgent: NonNullable<LLMProvider["chatStreamWithAgent"]>;
    };
  }

  /**
   * Agent SDKストリーミング実行ヘルパー
   *
   * イベントをイテレートし、共通ログを出力する。
   * ドメイン固有のイベント処理は onEvent コールバックで行う。
   */
  protected async runAgent(
    runId: string,
    prompt: string,
    agentDef: AgentDef,
    options?: {
      maxTurns?: number;
      permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
      onEvent?: (event: AgentEvent) => void | Promise<void>;
    },
  ): Promise<{
    finalResult: string;
    toolResults: string[];
    totalTurns: number;
    usage?: TokenUsage;
    totalCostUsd?: number;
  }> {
    const provider = this.ensureLLMProvider();

    const messages: Message[] = [{ role: "user", content: prompt }];
    const existingRun = this.registry.get(runId);

    const chatOptions: AgentChatOptions = {
      systemPrompt: agentDef.prompt,
      resume: existingRun?.sessionId,
      agent: {
        maxTurns: options?.maxTurns ?? 15,
        tools: agentDef.tools,
        allowedSkills: agentDef.allowedSkills,
        permissionMode: options?.permissionMode ?? "acceptEdits",
      },
    };

    let finalResult = "";
    const toolResults: string[] = [];
    let totalTurns = 0;
    let usage: TokenUsage | undefined;
    let totalCostUsd: number | undefined;

    for await (const event of provider.chatStreamWithAgent(
      messages,
      chatOptions,
    )) {
      switch (event.type) {
        case "tool_start":
          console.log(`[${this.agentName}] Tool start: ${event.tool}`);
          break;
        case "tool_result":
          console.log(
            `[${this.agentName}] Tool result: ${event.tool} -> ${event.result.slice(0, 100)}...`,
          );
          toolResults.push(event.result);
          break;
        case "turn_complete":
          console.log(`[${this.agentName}] Turn ${event.turnNumber} complete`);
          totalTurns = event.turnNumber;
          break;
        case "done":
          console.log(
            `[${this.agentName}] Done: ${event.result.slice(0, 200)}...`,
          );
          if (event.sessionId) {
            await this.registry.setSessionId(runId, event.sessionId);
          }
          if (event.usage) {
            usage = event.usage;
          }
          if (typeof event.totalCostUsd === "number") {
            totalCostUsd = event.totalCostUsd;
          }
          finalResult = event.result;
          break;
        case "cancelled":
          console.log(`[${this.agentName}] Cancelled: ${event.reason}`);
          break;
      }

      await options?.onEvent?.(event);
    }

    return {
      finalResult,
      toolResults,
      totalTurns,
      usage,
      totalCostUsd,
    };
  }

  /**
   * 未完了の実行を復旧
   *
   * checkpointのphaseが "completed" なら complete() を呼び出す。
   * それ以外は中断として記録するのみ。
   */
  async recoverPendingRuns(): Promise<void> {
    const pending = await this.registry.getPending();

    for (const run of pending) {
      if (run.agentName !== this.agentName) continue;

      const { phase } = run.checkpoint;

      if (phase === "completed") {
        await this.registry.complete(run.id);
        console.log(`[${this.agentName}] Recovered completed run: ${run.id}`);
      } else {
        console.log(
          `[${this.agentName}] Found interrupted run: ${run.id}, phase: ${String(phase)}`,
        );
      }
    }
  }
}
