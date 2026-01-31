import cron from "node-cron";

import { LogCollector } from "../../../platform/logs/collector.js";
import type { OutcomeContent } from "../../../platform/logs/types.js";
import { fetchGitHubChangelog } from "./changelog-fetcher.js";
import { fetchAnthropicNews, filterLast24Hours } from "./fetcher.js";
import { NewsStore } from "./store.js";
import type { NewsArticle } from "./types.js";

const SCHEDULE_CRON = "0 6 * * *";
const LOG_PREFIX = "NewsScheduler:";

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

  async run(): Promise<void> {
    console.log(`${LOG_PREFIX} Running news fetch...`);

    const articles = await fetchAnthropicNews({
      sources: ["blog", "research", "engineering"],
      translate: true,
    });
    const filtered = filterLast24Hours(articles);

    const changelogArticles = await this.fetchChangelog();
    const allArticles = [...filtered, ...changelogArticles];

    await this.store.save(allArticles);
    this.onUpdate(allArticles);
    this.logOutcomes(allArticles);

    console.log(
      `${LOG_PREFIX} Fetched and saved ${allArticles.length} articles (${filtered.length} news, ${changelogArticles.length} changelog)`,
    );
  }

  private async fetchChangelog(): Promise<NewsArticle[]> {
    try {
      const allChangelogArticles = await fetchGitHubChangelog({
        owner: "anthropics",
        repo: "claude-code",
      });
      const newArticles = allChangelogArticles.filter(
        (article) => !this.store.hasHash(article.contentHash!),
      );
      console.log(
        `${LOG_PREFIX} Found ${newArticles.length} new changelog entries`,
      );
      return newArticles;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error fetching changelog:`, error);
      return [];
    }
  }

  private logOutcomes(articles: NewsArticle[]): void {
    const collector = new LogCollector({ sessionId: "news-scheduler" });

    for (const article of articles) {
      const outcomeContent: OutcomeContent = {
        report: {
          title: article.title,
          summary: article.summary ?? "",
        },
      };
      collector.addOutcomeLog(
        crypto.randomUUID(),
        "",
        "report",
        "final",
        outcomeContent,
        undefined,
        {
          articleId: article.id,
          source: article.source,
          url: article.url,
        },
      );
    }
  }
}
