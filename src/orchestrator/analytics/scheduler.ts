import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";

import type { LogEntry } from "../../platform/logs/types.js";
import type { NewsArticle } from "../../capabilities/content/news/types.js";
import type { DailyReport, DailyStats, ReportItem } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../..");
const SKILLS_DIR = join(PROJECT_ROOT, ".claude", "skills");
const SCHEDULE_CRON = "0 5 * * *";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const LOG_PREFIX = "AnalyticsScheduler:";

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

async function runSkillScript(
  skillName: string,
  args: string[] = [],
  stdin?: string,
): Promise<string> {
  const scriptPath = join(SKILLS_DIR, skillName, "scripts", `${skillName}.ts`);

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", scriptPath, ...args], {
      cwd: PROJECT_ROOT,
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

export class AnalyticsScheduler {
  private task: cron.ScheduledTask | null = null;
  private onReportGenerated: (
    report: DailyReport,
    article: NewsArticle,
  ) => void;

  constructor(
    onReportGenerated: (report: DailyReport, article: NewsArticle) => void,
  ) {
    this.onReportGenerated = onReportGenerated;
  }

  start(): void {
    if (this.task !== null) {
      console.warn(`${LOG_PREFIX} Already started`);
      return;
    }

    this.task = cron.schedule(SCHEDULE_CRON, () => {
      this.run().catch((error) => {
        console.error(`${LOG_PREFIX} Error during scheduled run:`, error);
      });
    });

    console.log(`${LOG_PREFIX} Started (scheduled for 05:00 every day)`);
  }

  stop(): void {
    if (this.task === null) {
      console.warn(`${LOG_PREFIX} Not running`);
      return;
    }

    this.task.stop();
    this.task = null;

    console.log(`${LOG_PREFIX} Stopped`);
  }

  async run(): Promise<DailyReport> {
    console.log(`${LOG_PREFIX} Running log analysis via skills...`);

    try {
      return await this.runPipeline();
    } catch (error) {
      console.error(`${LOG_PREFIX} Skill pipeline failed:`, error);
      return this.createFallbackReport(error);
    }
  }

  private async runPipeline(): Promise<DailyReport> {
    console.log(`${LOG_PREFIX} [1/4] Running log-read...`);
    const logReadOutput = await runSkillScript("log-read");
    const logReadResult = JSON.parse(logReadOutput) as LogReadOutput;

    console.log(`${LOG_PREFIX} [2/4] Running log-analyze...`);
    const logAnalyzeOutput = await runSkillScript(
      "log-analyze",
      [],
      logReadOutput,
    );
    const logAnalyzeResult = JSON.parse(logAnalyzeOutput) as LogAnalyzeOutput;

    console.log(`${LOG_PREFIX} [3/4] Running glm-analyze...`);
    const glmInput = JSON.stringify({
      logs: logReadResult.logs,
      stats: logAnalyzeResult.stats,
    });
    const glmAnalyzeOutput = await runSkillScript("glm-analyze", [], glmInput);
    const glmAnalyzeResult = JSON.parse(glmAnalyzeOutput) as GLMAnalyzeOutput;

    console.log(`${LOG_PREFIX} [4/4] Running report-generate...`);
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

    this.onReportGenerated(reportResult.report, reportResult.article);
    console.log(`${LOG_PREFIX} Generated report ${reportResult.report.id}`);

    return reportResult.report;
  }

  private createFallbackReport(error: unknown): DailyReport {
    const now = new Date();
    const fallbackReport: DailyReport = {
      id: randomUUID(),
      source: "indra-log",
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
          description: error instanceof Error ? error.message : "不明なエラー",
        },
      ],
      periodStart: new Date(now.getTime() - ONE_DAY_MS).toISOString(),
      periodEnd: now.toISOString(),
      generatedAt: now.toISOString(),
    };

    const fallbackArticle: NewsArticle = {
      id: fallbackReport.id,
      source: "indra-log",
      title: fallbackReport.title,
      titleJa: null,
      summary: fallbackReport.summary,
      url: `#report/${fallbackReport.id}`,
      publishedAt: fallbackReport.generatedAt,
      fetchedAt: fallbackReport.generatedAt,
      body: JSON.stringify(fallbackReport, null, 2),
      bodyJa: null,
      imageUrl: null,
    };

    this.onReportGenerated(fallbackReport, fallbackArticle);

    return fallbackReport;
  }
}
