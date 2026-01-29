import cron from "node-cron";

import { LogCollector } from "../logs/collector.js";
import type { OutcomeContent } from "../logs/types.js";
import { fetchGitHubChangelog } from "./changelog-fetcher.js";
import { fetchAnthropicNews, filterLast24Hours } from "./fetcher.js";
import { NewsStore } from "./store.js";
import type { NewsArticle } from "./types.js";

export class NewsScheduler {
  private task: cron.ScheduledTask | null = null;
  private store: NewsStore;
  private onUpdate: (articles: NewsArticle[]) => void;

  constructor(store: NewsStore, onUpdate: (articles: NewsArticle[]) => void) {
    this.store = store;
    this.onUpdate = onUpdate;
  }

  start(): void {
    if (this.task !== null) {
      console.warn("NewsScheduler: Already started");
      return;
    }

    this.task = cron.schedule("0 6 * * *", () => {
      this.run().catch((error) => {
        console.error("NewsScheduler: Error during scheduled run:", error);
      });
    });

    console.log("NewsScheduler: Started (scheduled for 06:00 every day)");
  }

  stop(): void {
    if (this.task === null) {
      console.warn("NewsScheduler: Not running");
      return;
    }

    this.task.stop();
    this.task = null;

    console.log("NewsScheduler: Stopped");
  }

  async run(): Promise<void> {
    try {
      console.log("NewsScheduler: Running news fetch...");

      const articles = await fetchAnthropicNews();
      const filtered = filterLast24Hours(articles);

      let changelogArticles: NewsArticle[] = [];
      try {
        const allChangelogArticles = await fetchGitHubChangelog({
          owner: "anthropics",
          repo: "claude-code",
        });
        changelogArticles = allChangelogArticles.filter(
          (article) => !this.store.hasHash(article.contentHash!),
        );
        console.log(
          `NewsScheduler: Found ${changelogArticles.length} new changelog entries`,
        );
      } catch (changelogError) {
        console.error(
          "NewsScheduler: Error fetching changelog:",
          changelogError,
        );
      }

      const allArticles = [...filtered, ...changelogArticles];
      await this.store.save(allArticles);
      this.onUpdate(allArticles);

      // OutcomeLog記録（各記事ごと）
      const collector = new LogCollector({ sessionId: "news-scheduler" });
      for (const article of allArticles) {
        const outcomeId = crypto.randomUUID();
        const outcomeContent: OutcomeContent = {
          report: {
            title: article.title,
            summary: article.summary ?? "",
          },
        };
        collector.addOutcomeLog(
          outcomeId,
          "", // schedulerにはexecutionIdなし
          "report",
          "final", // schedulerの場合はdraftなしでfinal
          outcomeContent,
          undefined,
          {
            articleId: article.id,
            source: article.source,
            url: article.url,
          },
        );
      }

      console.log(
        `NewsScheduler: Fetched and saved ${allArticles.length} articles (${filtered.length} news, ${changelogArticles.length} changelog)`,
      );
    } catch (error) {
      console.error("NewsScheduler: Error during run:", error);
      throw error;
    }
  }
}
