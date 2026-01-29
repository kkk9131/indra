import { randomUUID } from "node:crypto";
import cron from "node-cron";
import type { NewsArticle } from "../news/types.js";
import type { NewsStore } from "../news/store.js";
import type { ApprovalQueue } from "../approval/queue.js";
import { NewsEvaluator, type RankedItem } from "./news-evaluator.js";

/** News Report のアイテム */
export interface NewsReportItem {
  rank: number;
  type: "news" | "post";
  title: string;
  summary: string;
  score: number;
  importance: number;
  novelty: number;
  impact: number;
  reason: string;
  sourceId: string;
  sourceUrl?: string;
}

/** News Report */
export interface NewsReport {
  id: string;
  source: "news-report";
  title: string;
  summary: string;
  topItems: NewsReportItem[];
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
}

/**
 * News Report スケジューラー
 *
 * 過去24時間のニュース・投稿を評価し、Top3レポートを生成する
 */
export class NewsReportScheduler {
  private task: cron.ScheduledTask | null = null;
  private newsStore: NewsStore;
  private approvalQueue: ApprovalQueue;
  private evaluator: NewsEvaluator;
  private onReportGenerated: (
    report: NewsReport,
    article: NewsArticle,
  ) => void | Promise<void>;

  constructor(
    newsStore: NewsStore,
    approvalQueue: ApprovalQueue,
    onReportGenerated: (
      report: NewsReport,
      article: NewsArticle,
    ) => void | Promise<void>,
  ) {
    this.newsStore = newsStore;
    this.approvalQueue = approvalQueue;
    this.evaluator = new NewsEvaluator();
    this.onReportGenerated = onReportGenerated;
  }

  /**
   * スケジューラーを開始（毎朝6時に実行）
   */
  start(): void {
    if (this.task !== null) {
      console.warn("NewsReportScheduler: Already started");
      return;
    }

    this.task = cron.schedule("0 6 * * *", () => {
      this.run().catch((error) => {
        console.error(
          "NewsReportScheduler: Error during scheduled run:",
          error,
        );
      });
    });

    console.log("NewsReportScheduler: Started (scheduled for 06:00 every day)");
  }

  /**
   * スケジューラーを停止
   */
  stop(): void {
    if (this.task === null) {
      console.warn("NewsReportScheduler: Not running");
      return;
    }

    this.task.stop();
    this.task = null;

    console.log("NewsReportScheduler: Stopped");
  }

  /**
   * 過去24時間のニュースを取得
   */
  private getRecentNews(): NewsArticle[] {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allArticles = this.newsStore.list();
    return allArticles.filter((article) => {
      const fetchedAt = new Date(article.fetchedAt);
      // news-report と indra-log は評価対象から除外
      if (article.source === "news-report" || article.source === "indra-log") {
        return false;
      }
      return fetchedAt >= yesterday;
    });
  }

  /**
   * 過去24時間の投稿済みアイテムを取得
   */
  private getRecentPosts(): ReturnType<ApprovalQueue["list"]> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allItems = this.approvalQueue.list();
    return allItems.filter((item) => {
      if (item.status !== "posted") {
        return false;
      }
      const createdAt = new Date(item.createdAt);
      return createdAt >= yesterday;
    });
  }

  /**
   * News Report を手動実行
   */
  async run(): Promise<NewsReport> {
    console.log("NewsReportScheduler: Running news report generation...");

    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();

    // 過去24時間のニュース・投稿を取得
    const recentNews = this.getRecentNews();
    const recentPosts = this.getRecentPosts();

    console.log(
      `NewsReportScheduler: Found ${recentNews.length} news, ${recentPosts.length} posts`,
    );

    // 評価アイテムを作成
    const evaluationItems = [
      ...recentNews.map((article) =>
        this.evaluator.newsToEvaluationItem(article),
      ),
      ...recentPosts.map((post) => this.evaluator.postToEvaluationItem(post)),
    ];

    let rankedItems: RankedItem[] = [];
    let summary = "";

    if (evaluationItems.length > 0) {
      // GLMで評価
      rankedItems = await this.evaluator.evaluate(evaluationItems);
      summary = await this.evaluator.generateSummary(rankedItems);
    } else {
      summary = "過去24時間に評価対象のニュース・投稿がありませんでした。";
    }

    // レポートを作成
    const report: NewsReport = {
      id: randomUUID(),
      source: "news-report",
      title: `Daily News Report - ${now.toLocaleDateString("ja-JP")}`,
      summary,
      topItems: rankedItems.map((r) => ({
        rank: r.rank,
        type: r.item.type,
        title: r.item.title,
        summary: r.item.summary.substring(0, 200),
        score: r.evaluation.score,
        importance: r.evaluation.importance,
        novelty: r.evaluation.novelty,
        impact: r.evaluation.impact,
        reason: r.evaluation.reason,
        sourceId: r.item.id,
        sourceUrl: r.item.sourceUrl,
      })),
      periodStart,
      periodEnd,
      generatedAt: now.toISOString(),
    };

    // NewsArticle 形式に変換
    const article = this.reportToArticle(report);

    // コールバックで通知
    await this.onReportGenerated(report, article);

    console.log(`NewsReportScheduler: Generated report ${report.id}`);

    return report;
  }

  /**
   * NewsReport を NewsArticle に変換
   */
  private reportToArticle(report: NewsReport): NewsArticle {
    // Top3 アイテムを含む詳細なサマリー
    const topItemsSummary = report.topItems
      .map(
        (item) =>
          `${item.rank}. [${item.type === "news" ? "📰" : "🐦"}] ${item.title}\n` +
          `   スコア: ${item.score.toFixed(1)} | ${item.reason}`,
      )
      .join("\n\n");

    const fullSummary = report.summary + "\n\n📊 Top 3:\n" + topItemsSummary;

    return {
      id: report.id,
      source: "news-report",
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
