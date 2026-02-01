import cron from "node-cron";
import type {
  ApprovalQueue,
  ApprovalItem,
} from "../../platform/approval/index.js";
import type { CredentialStore } from "../../platform/auth/index.js";
import { XConnector } from "../../integrations/index.js";

export class PostScheduler {
  private task: cron.ScheduledTask | null = null;

  constructor(
    private approvalQueue: ApprovalQueue,
    private credentialStore: CredentialStore,
    private onPost?: (item: ApprovalItem) => void,
  ) {}

  start(): void {
    if (this.task !== null) {
      console.warn("PostScheduler: Already started");
      return;
    }

    this.task = cron.schedule("* * * * *", () => {
      this.run().catch((error) => {
        console.error("PostScheduler: Error during scheduled run:", error);
      });
    });

    console.log("PostScheduler: Started (runs every minute)");
  }

  stop(): void {
    if (this.task === null) {
      console.warn("PostScheduler: Not running");
      return;
    }

    this.task.stop();
    this.task = null;

    console.log("PostScheduler: Stopped");
  }

  async run(): Promise<void> {
    const dueItems = this.approvalQueue.listScheduledDue();
    if (dueItems.length === 0) {
      return;
    }

    console.log(`PostScheduler: Processing ${dueItems.length} due item(s)`);

    for (const item of dueItems) {
      await this.processItem(item);
    }
  }

  private async processItem(item: ApprovalItem): Promise<void> {
    if (item.platform !== "x") {
      this.approvalQueue.markFailed(
        item.id,
        `Unsupported platform: ${item.platform}`,
      );
      return;
    }

    const xCreds = this.credentialStore.getXCredentials();
    if (!xCreds || this.credentialStore.isXTokenExpired()) {
      this.approvalQueue.markFailed(
        item.id,
        "X credentials not available or expired",
      );
      return;
    }

    try {
      const connector = new XConnector({
        oauth2AccessToken: xCreds.accessToken,
      });
      await connector.connect();
      const result = await connector.post(item.content);

      if (result.success && result.postId && result.url) {
        this.approvalQueue.markPosted(item.id, result.postId, result.url);
        const postedItem = this.approvalQueue.get(item.id);
        if (postedItem) {
          this.onPost?.(postedItem);
        }
        console.log(`PostScheduler: Posted ${item.id} to X`);
      } else {
        this.approvalQueue.markFailed(item.id, result.error ?? "Unknown error");
        console.error(
          `PostScheduler: Failed to post ${item.id}: ${result.error}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.approvalQueue.markFailed(item.id, message);
      console.error(`PostScheduler: Error posting ${item.id}:`, error);
    }
  }
}
