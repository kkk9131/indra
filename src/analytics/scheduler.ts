import cron from "node-cron";

import type { LogAnalyzer } from "./analyzer.js";
import type { DailyReport } from "./types.js";
import type { NewsArticle } from "../news/types.js";

/**
 * 日次ログ分析スケジューラー
 */
export class AnalyticsScheduler {
  private task: cron.ScheduledTask | null = null;
  private analyzer: LogAnalyzer;
  private onReportGenerated: (
    report: DailyReport,
    article: NewsArticle,
  ) => void;

  /**
   * @param analyzer ログ分析エンジン
   * @param onReportGenerated レポート生成時のコールバック
   */
  constructor(
    analyzer: LogAnalyzer,
    onReportGenerated: (report: DailyReport, article: NewsArticle) => void,
  ) {
    this.analyzer = analyzer;
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
   * ログ分析を手動実行
   */
  async run(): Promise<DailyReport> {
    console.log("AnalyticsScheduler: Running log analysis...");

    const report = await this.analyzer.generateDailyReport();

    // レポートをNewsArticle形式に変換
    const article = this.reportToArticle(report);

    // コールバックで通知
    this.onReportGenerated(report, article);

    console.log(`AnalyticsScheduler: Generated report ${report.id}`);

    return report;
  }

  /**
   * DailyReportをNewsArticle形式に変換
   */
  private reportToArticle(report: DailyReport): NewsArticle {
    // 統計情報を要約に含める
    const statsInfo = [
      `総ログ: ${report.stats.totalLogs}`,
      `エラー: ${report.stats.errorCount}`,
      `警告: ${report.stats.warningCount}`,
      `セッション: ${report.stats.uniqueSessions}`,
    ].join(" | ");

    const fullSummary = `${report.summary}\n\n📊 ${statsInfo}`;

    return {
      id: report.id,
      source: "log-analysis",
      title: report.title,
      summary: fullSummary,
      url: `#report/${report.id}`,
      publishedAt: report.generatedAt,
      fetchedAt: report.generatedAt,
      body: JSON.stringify(report, null, 2),
      imageUrl: null,
    };
  }
}
