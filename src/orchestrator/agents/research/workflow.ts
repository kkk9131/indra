/**
 * リサーチワークフロー
 *
 * トピックを調査してレポートを作成するワークフローを管理
 */

import {
  type RunRegistry,
  createRegistryHooksWithErrorHandling,
} from "../subagent/index.js";
import { createResearchAgents, toSDKAgentFormat } from "./agents.js";

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
  constructor(private registry: RunRegistry) {}

  /**
   * リサーチを実行
   */
  async execute(config: ResearchConfig): Promise<ResearchResult> {
    const { topic, depth = "normal", language = "ja" } = config;

    try {
      // 1. 実行開始を記録
      const run = await this.registry.start("research-agent", {
        topic,
        depth,
        language,
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

      // 3. サブエージェント定義を作成
      const agents = await createResearchAgents();
      const sdkAgents = toSDKAgentFormat(agents);

      // 4. フック設定
      const hooks = createRegistryHooksWithErrorHandling(
        this.registry,
        run.id,
        (error) => console.error("Hook error:", error),
      );

      // 5. ワークフロー実行
      const result = await this.executeWorkflow(
        run.id,
        config,
        sdkAgents,
        hooks,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
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
    _agents: Record<string, unknown>,
    _hooks: unknown,
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
    const queries: string[] = [];

    // 基本クエリ
    queries.push(topic);

    // 言語に応じたバリエーション
    if (language === "ja") {
      queries.push(`${topic} 最新`);
      queries.push(`${topic} トレンド`);
      queries.push(`${topic} 解説`);
    } else {
      queries.push(`${topic} latest`);
      queries.push(`${topic} trends`);
      queries.push(`${topic} explained`);
    }

    return queries;
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
