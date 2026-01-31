import { randomUUID } from "node:crypto";
import cron from "node-cron";

import type { ApprovalQueue } from "../../platform/approval/queue.js";
import type { NewsStore } from "../../capabilities/content/news/store.js";
import type { NewsArticle } from "../../capabilities/content/news/types.js";
import { NewsEvaluator, type RankedItem } from "./news-evaluator.js";

const SCHEDULE_CRON = "0 6 * * *";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const LOG_PREFIX = "NewsReportScheduler:";

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

    console.log(`${LOG_PREFIX} Started (scheduled for 06:00 every day)`);
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

  private getRecentNews(): NewsArticle[] {
    const cutoff = new Date(Date.now() - ONE_DAY_MS);
    const excludedSources = new Set(["news-report", "indra-log"]);

    return this.newsStore.list().filter((article) => {
      if (excludedSources.has(article.source)) {
        return false;
      }
      return new Date(article.fetchedAt) >= cutoff;
    });
  }

  private getRecentPosts(): ReturnType<ApprovalQueue["list"]> {
    const cutoff = new Date(Date.now() - ONE_DAY_MS);

    return this.approvalQueue.list().filter((item) => {
      if (item.status !== "posted") {
        return false;
      }
      return new Date(item.createdAt) >= cutoff;
    });
  }

  async run(): Promise<NewsReport> {
    console.log(`${LOG_PREFIX} Running news report generation...`);

    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(now.getTime() - ONE_DAY_MS).toISOString();

    const recentNews = this.getRecentNews();
    const recentPosts = this.getRecentPosts();

    console.log(
      `${LOG_PREFIX} Found ${recentNews.length} news, ${recentPosts.length} posts`,
    );

    const evaluationItems = [
      ...recentNews.map((article) =>
        this.evaluator.newsToEvaluationItem(article),
      ),
      ...recentPosts.map((post) => this.evaluator.postToEvaluationItem(post)),
    ];

    const [rankedItems, summary] =
      evaluationItems.length > 0
        ? await this.evaluateItems(evaluationItems)
        : [[], "過去24時間に評価対象のニュース・投稿がありませんでした。"];

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

    const article = this.reportToArticle(report);
    await this.onReportGenerated(report, article);

    console.log(`${LOG_PREFIX} Generated report ${report.id}`);

    return report;
  }

  private async evaluateItems(
    items: ReturnType<NewsEvaluator["newsToEvaluationItem"]>[],
  ): Promise<[RankedItem[], string]> {
    const rankedItems = await this.evaluator.evaluate(items);
    const summary = await this.evaluator.generateSummary(rankedItems);
    return [rankedItems, summary];
  }

  private reportToArticle(report: NewsReport): NewsArticle {
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
      titleJa: null,
      summary: fullSummary,
      url: `#report/${report.id}`,
      publishedAt: report.generatedAt,
      fetchedAt: report.generatedAt,
      body: JSON.stringify(report, null, 2),
      bodyJa: null,
      imageUrl: null,
    };
  }
}
