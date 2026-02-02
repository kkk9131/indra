import { promises as fs } from "fs";
import { type RunRegistry } from "../subagent/index.js";
import { createResearchAgents } from "./agents.js";
import { extractReportSummary } from "./utils.js";
import type { LLMProvider } from "../../llm/index.js";
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

export class ResearchWorkflow {
  private logCallbacks: ResearchLogCallbacks | null = null;
  private llmProvider: LLMProvider | null = null;

  constructor(private registry: RunRegistry) {}

  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  setLogCallbacks(callbacks: ResearchLogCallbacks): void {
    this.logCallbacks = callbacks;
  }

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

  private async executeWorkflow(
    runId: string,
    config: ResearchConfig,
  ): Promise<ResearchResult> {
    const { topic, depth = "normal", language = "ja" } = config;

    if (!this.llmProvider?.chatStreamWithAgent) {
      return {
        success: false,
        runId,
        error: "LLM provider with agent support not configured",
      };
    }

    // 出力パスを生成（絶対パスで指定）
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const safeTopic = topic
      .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "-")
      .slice(0, 30);
    const baseDir = process.cwd();
    const outputDir = `${baseDir}/agent-output/research-${dateStr}-${safeTopic}`;
    const outputPath = `${outputDir}/report.md`;

    // Phase 1: Collecting
    await this.registry.updateCheckpoint(runId, { phase: "collecting" });

    // エージェント定義を取得（agents.ts から）
    const agents = await createResearchAgents();
    const agentDef = agents["research-agent"];

    // Agent SDK で research-report スキルを呼び出し
    const maxTurns = depth === "deep" ? 30 : depth === "quick" ? 10 : 20;
    const langInstruction = language === "ja" ? "日本語で" : "in English";

    const prompt = `research-report スキルを使って、${langInstruction}以下のトピックについてリサーチレポートを作成してください。
出力先: ${outputPath}
調査深度: ${depth}

トピック: ${topic}`;

    // Phase 2: Analyzing
    await this.registry.updateCheckpoint(runId, { phase: "analyzing" });

    // Phase 3: Deep-Analyzing（オプション）
    if (depth === "deep") {
      await this.registry.updateCheckpoint(runId, { phase: "deep-analyzing" });
    }

    // Phase 4: Generating
    await this.registry.updateCheckpoint(runId, { phase: "generating" });

    // chatStreamWithAgent を使用（chat と同じ方式）
    console.log(`[Research] Starting with prompt: ${prompt.slice(0, 100)}...`);
    console.log(
      `[Research] Agent tools: ${agentDef.tools?.join(", ") ?? "none"}`,
    );
    console.log(`[Research] maxTurns: ${maxTurns}`);

    for await (const event of this.llmProvider.chatStreamWithAgent(
      [{ role: "user", content: prompt }],
      {
        systemPrompt: agentDef.prompt,
        agent: {
          maxTurns,
          tools: agentDef.tools,
          permissionMode: "acceptEdits",
        },
      },
    )) {
      // すべてのイベントをログ出力
      if (event.type === "tool_start") {
        console.log(`[Research] Tool start: ${event.tool}`);
      } else if (event.type === "tool_result") {
        console.log(
          `[Research] Tool result: ${event.tool} -> ${event.result.slice(0, 100)}...`,
        );
      } else if (event.type === "turn_complete") {
        console.log(`[Research] Turn ${event.turnNumber} complete`);
      } else if (event.type === "text") {
        // テキストは省略（長すぎる）
      } else if (event.type === "done") {
        console.log(`[Research] Done: ${event.result.slice(0, 200)}...`);
      } else if (event.type === "cancelled") {
        console.log(`[Research] Cancelled: ${event.reason}`);
      }
    }

    // ファイルが生成されたか確認
    try {
      await fs.access(outputPath);
    } catch {
      return {
        success: false,
        runId,
        error: `Report file not created: ${outputPath}`,
      };
    }

    // Phase 5: Completed
    await this.registry.updateCheckpoint(runId, {
      phase: "completed",
      outputPath,
    });

    await this.registry.complete(runId);

    // Discord通知（オプショナル）
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
        // Discord通知の失敗はワークフロー全体を失敗させない
        console.error(
          "[Research] Discord notification failed:",
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
