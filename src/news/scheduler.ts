import cron from "node-cron";

import { fetchAnthropicNews, filterLast24Hours } from "./fetcher.js";
import { NewsStore } from "./store.js";
import type { NewsArticle } from "./types.js";

/**
 * ニュース自動更新スケジューラー
 */
export class NewsScheduler {
  private task: cron.ScheduledTask | null = null;
  private store: NewsStore;
  private onUpdate: (articles: NewsArticle[]) => void;

  /**
   * @param store ニュース記事を保存するストア
   * @param onUpdate 記事更新時のコールバック
   */
  constructor(store: NewsStore, onUpdate: (articles: NewsArticle[]) => void) {
    this.store = store;
    this.onUpdate = onUpdate;
  }

  /**
   * スケジューラーを開始（毎朝6時に実行）
   */
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

  /**
   * スケジューラーを停止
   */
  stop(): void {
    if (this.task === null) {
      console.warn("NewsScheduler: Not running");
      return;
    }

    this.task.stop();
    this.task = null;

    console.log("NewsScheduler: Stopped");
  }

  /**
   * ニュース更新を手動実行
   */
  async run(): Promise<void> {
    try {
      console.log("NewsScheduler: Running news fetch...");

      // Anthropic Newsを取得
      const articles = await fetchAnthropicNews();

      // 過去24時間のみをフィルタ
      const filtered = filterLast24Hours(articles);

      // ストアに保存
      await this.store.save(filtered);

      // 更新を通知
      this.onUpdate(filtered);

      console.log(
        `NewsScheduler: Fetched and saved ${filtered.length} articles`,
      );
    } catch (error) {
      console.error("NewsScheduler: Error during run:", error);
      throw error;
    }
  }
}
