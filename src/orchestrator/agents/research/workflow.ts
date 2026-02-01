/**
 * リサーチワークフロー
 *
 * トピックを調査してレポートを作成するワークフローを管理
 */

import { type RunRegistry } from "../subagent/index.js";
// TODO: 将来のLLM統合時に使用
// import { createRegistryHooksWithErrorHandling } from "../subagent/index.js";
// import { createResearchAgents, toSDKAgentFormat } from "./agents.js";
import type {
  OutcomeType,
  OutcomeStage,
  OutcomeContent,
  ExecutionConfig,
  ExecutionResult,
  ExecutionError,
} from "../../../platform/logs/index.js";

/**
 * ログ記録用のコールバック型
 */
export interface ResearchLogCallbacks {
  saveExecutionLog: (
    executionId: string,
    action: "start" | "end" | "error",
    params: {
      config?: ExecutionConfig;
      input?: string;
      result?: ExecutionResult;
      error?: ExecutionError;
    },
  ) => void;
  saveOutcomeLog: (
    outcomeId: string,
    executionId: string,
    outcomeType: OutcomeType,
    stage: OutcomeStage,
    content: OutcomeContent,
  ) => void;
}

export type ResearchPhase =
  | "collecting"
  | "analyzing"
  | "deep-analyzing"
  | "generating"
  | "completed";

export interface ResearchCheckpoint {
  topic: string;
  phase: ResearchPhase;
  searchQueries?: string[];
  sources?: Array<{
    url: string;
    title: string;
    summary: string;
    reliability: "high" | "medium" | "low";
  }>;
  outputPath?: string;
}

export interface ResearchConfig {
  topic: string;
  depth?: "quick" | "normal" | "deep";
  language?: "ja" | "en";
  useLLMs?: boolean;
}

export interface ResearchResult {
  success: boolean;
  runId: string;
  outputPath?: string;
  error?: string;
}

export class ResearchWorkflow {
  private logCallbacks: ResearchLogCallbacks | null = null;

  constructor(private registry: RunRegistry) {}

  /**
   * ログ記録コールバックを設定
   */
  setLogCallbacks(callbacks: ResearchLogCallbacks): void {
    this.logCallbacks = callbacks;
  }

  /**
   * リサーチを実行
   */
  async execute(config: ResearchConfig): Promise<ResearchResult> {
    const { topic } = config;
    const depth = config.depth ?? "normal";
    const language = config.language ?? "ja";

    try {
      // 1. 実行開始を記録
      const run = await this.registry.start("research-agent", {
        topic,
        depth,
        language,
      });

      // ログ記録: 実行開始
      this.logCallbacks?.saveExecutionLog(run.id, "start", {
        config: {
          model: "research-agent",
          maxTurns: 10,
          tools: ["web_search", "read_file"],
          permissionMode: "auto",
        },
        input: `topic=${topic}, depth=${depth}, language=${language}`,
      });

      // 2. チェックポイント初期化
      const initialCheckpoint: ResearchCheckpoint = {
        topic,
        phase: "collecting",
      };
      await this.registry.updateCheckpoint(
        run.id,
        initialCheckpoint as unknown as Record<string, unknown>,
      );

      // 3. ワークフロー実行
      // TODO: 将来のLLM統合時にサブエージェントとフックを使用
      const result = await this.executeWorkflow(run.id, config);

      // ログ記録: 実行終了
      if (result.success) {
        this.logCallbacks?.saveExecutionLog(run.id, "end", {
          result: {
            success: true,
            totalTurns: 1,
            totalTokens: 0,
            duration: 0,
          },
        });

        // ログ記録: レポート成果物
        const outcomeId = crypto.randomUUID();
        this.logCallbacks?.saveOutcomeLog(
          outcomeId,
          run.id,
          "report",
          "final",
          {
            report: {
              title: topic,
              summary: `Research report generated: ${result.outputPath}`,
            },
          },
        );
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // ログ記録: エラー
      this.logCallbacks?.saveExecutionLog("research-error", "error", {
        error: { code: "RESEARCH_ERROR", message: errorMessage },
      });

      return {
        success: false,
        runId: "",
        error: errorMessage,
      };
    }
  }

  /**
   * ワークフローを実行
   */
  private async executeWorkflow(
    runId: string,
    config: ResearchConfig,
  ): Promise<ResearchResult> {
    const { topic, depth = "normal", language = "ja" } = config;

    // Phase 1: Collecting
    await this.registry.updateCheckpoint(runId, { phase: "collecting" });

    // 検索クエリ生成（仮実装）
    const searchQueries = this.generateSearchQueries(topic, language);
    await this.registry.updateCheckpoint(runId, { searchQueries });

    // Phase 2: Analyzing
    await this.registry.updateCheckpoint(runId, { phase: "analyzing" });

    // Phase 3: Deep-Analyzing（オプション）
    if (depth === "deep") {
      await this.registry.updateCheckpoint(runId, { phase: "deep-analyzing" });
    }

    // Phase 4: Generating
    await this.registry.updateCheckpoint(runId, { phase: "generating" });

    // 出力パスを生成
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const safeTopic = topic
      .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "-")
      .slice(0, 30);
    const outputPath = `agent-output/research-${dateStr}-${safeTopic}/report.md`;

    // Phase 5: Completed
    await this.registry.updateCheckpoint(runId, {
      phase: "completed",
      outputPath,
    });

    await this.registry.complete(runId);

    return {
      success: true,
      runId,
      outputPath,
    };
  }

  /**
   * 検索クエリを生成
   */
  private generateSearchQueries(topic: string, language: string): string[] {
    const suffixes =
      language === "ja"
        ? ["", " 最新", " トレンド", " 解説"]
        : ["", " latest", " trends", " explained"];

    return suffixes.map((suffix) => topic + suffix);
  }

  /**
   * 未完了のワークフローを復旧
   */
  async recoverPendingRuns(): Promise<void> {
    const pending = await this.registry.getPending();

    for (const run of pending) {
      if (run.agentName !== "research-agent") {
        continue;
      }

      const checkpoint = run.checkpoint as unknown as ResearchCheckpoint;

      if (checkpoint.phase === "completed") {
        await this.registry.complete(run.id);
        console.log(`Recovered completed research run: ${run.id}`);
      } else {
        console.log(
          `Found interrupted research run: ${run.id}, phase: ${checkpoint.phase}`,
        );
      }
    }
  }
}
