import { promises as fs } from "fs";
import { BaseWorkflow } from "../subagent/base-workflow.js";
import { createResearchAgents } from "./agents.js";
import { extractReportSummary } from "./utils.js";
import type { ResearchReport } from "../../analytics/discord-notifier.js";
import type {
  OutcomeType,
  OutcomeStage,
  OutcomeContent,
  ExecutionConfig,
  ExecutionResult,
  ExecutionError,
} from "../../../platform/logs/index.js";

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
  notifyDiscord?: (report: ResearchReport) => Promise<void>;
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

export class ResearchWorkflow extends BaseWorkflow<
  ResearchConfig,
  ResearchResult,
  ResearchCheckpoint
> {
  private logCallbacks: ResearchLogCallbacks | null = null;

  setLogCallbacks(callbacks: ResearchLogCallbacks): void {
    this.logCallbacks = callbacks;
  }

  protected get agentName(): string {
    return "research-agent";
  }

  protected initCheckpoint(config: ResearchConfig): ResearchCheckpoint {
    return {
      topic: config.topic,
      phase: "collecting",
    };
  }

  /**
   * ログコールバック統合付きの実行
   *
   * エラー時は例外を投げずに success=false を返す。
   */
  override async execute(config: ResearchConfig): Promise<ResearchResult> {
    const { topic, depth = "normal", language = "ja" } = config;

    const originalOnStart = this.lifecycleHooks.onStart;
    this.lifecycleHooks.onStart = async (runId, agentName) => {
      this.logCallbacks?.saveExecutionLog(runId, "start", {
        config: {
          model: "research-agent",
          maxTurns: 10,
          tools: ["web_search", "read_file"],
          permissionMode: "auto",
        },
        input: `topic=${topic}, depth=${depth}, language=${language}`,
      });
      await originalOnStart?.(runId, agentName);
    };

    try {
      const result = await super.execute(config);

      if (result.success) {
        this.logCallbacks?.saveExecutionLog(result.runId, "end", {
          result: {
            success: true,
            totalTurns: 1,
            totalTokens: 0,
            duration: 0,
          },
        });

        this.logCallbacks?.saveOutcomeLog(
          crypto.randomUUID(),
          result.runId,
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

      this.logCallbacks?.saveExecutionLog("research-error", "error", {
        error: { code: "RESEARCH_ERROR", message: errorMessage },
      });

      return {
        success: false,
        runId: "",
        error: errorMessage,
      };
    } finally {
      this.lifecycleHooks.onStart = originalOnStart;
    }
  }

  /**
   * ドメイン固有のワークフロー実行
   *
   * BaseWorkflow.execute() から呼ばれる。
   * レジストリ管理（start/complete/fail）は基底クラスが担当。
   */
  protected async run(
    runId: string,
    config: ResearchConfig,
  ): Promise<ResearchResult> {
    const { topic, depth = "normal", language = "ja" } = config;

    this.ensureLLMProvider();

    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const safeTopic = topic
      .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "-")
      .slice(0, 30);
    const baseDir = process.cwd();
    const outputDir = `${baseDir}/agent-output/research-${dateStr}-${safeTopic}`;
    const outputPath = `${outputDir}/report.md`;

    await this.updatePhase(runId, "collecting");

    const agents = await createResearchAgents();
    const agentDef = agents["research-agent"];

    const maxTurnsByDepth = { deep: 30, quick: 10, normal: 20 } as const;
    const maxTurns = maxTurnsByDepth[depth];
    const langInstruction = language === "ja" ? "日本語で" : "in English";

    const prompt = `research-report スキルを使って、${langInstruction}以下のトピックについてリサーチレポートを作成してください。
出力先: ${outputPath}
調査深度: ${depth}

トピック: ${topic}`;

    await this.updatePhase(runId, "analyzing");
    if (depth === "deep") {
      await this.updatePhase(runId, "deep-analyzing");
    }
    await this.updatePhase(runId, "generating");

    console.log(
      `[${this.agentName}] Agent tools: ${agentDef.tools?.join(", ") ?? "none"}`,
    );
    console.log(`[${this.agentName}] maxTurns: ${maxTurns}`);

    await this.runAgent(runId, prompt, agentDef, { maxTurns });

    try {
      await fs.access(outputPath);
    } catch {
      throw new Error(`Report file not created: ${outputPath}`);
    }

    await this.registry.updateCheckpoint(runId, {
      phase: "completed",
      outputPath,
    });

    if (this.logCallbacks?.notifyDiscord) {
      try {
        const summaryInfo = await extractReportSummary(outputPath);
        await this.logCallbacks.notifyDiscord({
          id: runId,
          topic,
          outputPath,
          generatedAt: new Date().toISOString(),
          summary: summaryInfo?.summary,
          keyPoints: summaryInfo?.keyPoints,
        });
      } catch (error) {
        console.error(
          `[${this.agentName}] Discord notification failed:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return {
      success: true,
      runId,
      outputPath,
    };
  }
}
