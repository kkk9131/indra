import cron from "node-cron";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { DailyReport, DailyStats, ReportItem } from "./types.js";
import type { NewsArticle } from "../news/types.js";
import type { LogEntry } from "../logs/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, "../../.claude/skills");

interface LogReadOutput {
  logs: LogEntry[];
  metadata: {
    totalCount: number;
    periodStart: string;
    periodEnd: string;
  };
}

interface LogAnalyzeOutput {
  stats: DailyStats;
}

interface GLMAnalyzeOutput {
  summary: string;
  items: ReportItem[];
}

interface ReportGenerateOutput {
  report: DailyReport;
  article: NewsArticle;
}

/**
 * スキルスクリプトを実行
 */
async function runSkillScript(
  skillName: string,
  args: string[] = [],
  stdin?: string,
): Promise<string> {
  const scriptPath = join(SKILLS_DIR, skillName, "scripts", `${skillName}.ts`);

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", scriptPath, ...args], {
      cwd: join(__dirname, "../.."),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        // dotenvのログ出力を除去（[dotenv@... で始まる行）
        const cleanedOutput = stdout
          .split("\n")
          .filter((line) => !line.startsWith("[dotenv@"))
          .join("\n");
        resolve(cleanedOutput);
      } else {
        reject(new Error(`Skill ${skillName} failed: ${stderr}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

/**
 * 日次ログ分析スケジューラー
 *
 * スキル/サブエージェント構成で動作:
 * 1. log-read: ログ読み取り
 * 2. log-analyze: 統計計算
 * 3. glm-analyze: GLM深層分析
 * 4. report-generate: レポート生成
 */
export class AnalyticsScheduler {
  private task: cron.ScheduledTask | null = null;
  private onReportGenerated: (
    report: DailyReport,
    article: NewsArticle,
  ) => void;

  /**
   * @param onReportGenerated レポート生成時のコールバック
   */
  constructor(
    onReportGenerated: (report: DailyReport, article: NewsArticle) => void,
  ) {
    this.onReportGenerated = onReportGenerated;
  }

  /**
   * スケジューラーを開始（毎朝5時に実行）
   */
  start(): void {
    if (this.task !== null) {
      console.warn("AnalyticsScheduler: Already started");
      return;
    }

    this.task = cron.schedule("0 5 * * *", () => {
      this.run().catch((error) => {
        console.error("AnalyticsScheduler: Error during scheduled run:", error);
      });
    });

    console.log("AnalyticsScheduler: Started (scheduled for 05:00 every day)");
  }

  /**
   * スケジューラーを停止
   */
  stop(): void {
    if (this.task === null) {
      console.warn("AnalyticsScheduler: Not running");
      return;
    }

    this.task.stop();
    this.task = null;

    console.log("AnalyticsScheduler: Stopped");
  }

  /**
   * ログ分析を手動実行（スキルパイプライン経由）
   */
  async run(): Promise<DailyReport> {
    console.log("AnalyticsScheduler: Running log analysis via skills...");

    try {
      // Step 1: log-read でログ取得
      console.log("AnalyticsScheduler: [1/4] Running log-read...");
      const logReadOutput = await runSkillScript("log-read");
      const logReadResult = JSON.parse(logReadOutput) as LogReadOutput;

      // Step 2: log-analyze で統計計算
      console.log("AnalyticsScheduler: [2/4] Running log-analyze...");
      const logAnalyzeOutput = await runSkillScript(
        "log-analyze",
        [],
        logReadOutput,
      );
      const logAnalyzeResult = JSON.parse(logAnalyzeOutput) as LogAnalyzeOutput;

      // Step 3: glm-analyze でGLM分析
      console.log("AnalyticsScheduler: [3/4] Running glm-analyze...");
      const glmInput = JSON.stringify({
        logs: logReadResult.logs,
        stats: logAnalyzeResult.stats,
      });
      const glmAnalyzeOutput = await runSkillScript(
        "glm-analyze",
        [],
        glmInput,
      );
      const glmAnalyzeResult = JSON.parse(glmAnalyzeOutput) as GLMAnalyzeOutput;

      // Step 4: report-generate でレポート生成
      console.log("AnalyticsScheduler: [4/4] Running report-generate...");
      const reportInput = JSON.stringify({
        stats: logAnalyzeResult.stats,
        analysis: glmAnalyzeResult,
        period: {
          start: logReadResult.metadata.periodStart,
          end: logReadResult.metadata.periodEnd,
        },
      });
      const reportOutput = await runSkillScript(
        "report-generate",
        [],
        reportInput,
      );
      const reportResult = JSON.parse(reportOutput) as ReportGenerateOutput;

      // コールバックで通知
      this.onReportGenerated(reportResult.report, reportResult.article);

      console.log(
        `AnalyticsScheduler: Generated report ${reportResult.report.id}`,
      );

      return reportResult.report;
    } catch (error) {
      console.error("AnalyticsScheduler: Skill pipeline failed:", error);

      // フォールバック: 最小限のレポートを生成
      const now = new Date();
      const fallbackReport: DailyReport = {
        id: randomUUID(),
        source: "log-analysis",
        title: `Daily Log Report - ${now.toLocaleDateString("ja-JP")}`,
        summary: "スキルパイプラインでエラーが発生しました。",
        stats: {
          totalLogs: 0,
          agentLogs: 0,
          promptLogs: 0,
          systemLogs: 0,
          errorCount: 0,
          warningCount: 0,
          toolUsage: {},
          uniqueSessions: 0,
        },
        items: [
          {
            severity: "error",
            category: "error",
            title: "分析エラー",
            description:
              error instanceof Error ? error.message : "不明なエラー",
          },
        ],
        periodStart: new Date(
          now.getTime() - 24 * 60 * 60 * 1000,
        ).toISOString(),
        periodEnd: now.toISOString(),
        generatedAt: now.toISOString(),
      };

      const fallbackArticle: NewsArticle = {
        id: fallbackReport.id,
        source: "log-analysis",
        title: fallbackReport.title,
        summary: fallbackReport.summary,
        url: `#report/${fallbackReport.id}`,
        publishedAt: fallbackReport.generatedAt,
        fetchedAt: fallbackReport.generatedAt,
        body: JSON.stringify(fallbackReport, null, 2),
        imageUrl: null,
      };

      this.onReportGenerated(fallbackReport, fallbackArticle);

      return fallbackReport;
    }
  }
}
