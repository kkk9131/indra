import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import type {
  ApprovalItem,
  ApprovalStatus,
  CreateApprovalItem,
} from "./types.js";
import { ApprovalItemSchema } from "./types.js";
import { LogCollector } from "../logs/collector.js";
import type { OutcomeContent } from "../logs/types.js";

const ALL_STATUSES: readonly ApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "posted",
  "scheduled",
];

type ItemUpdates = Partial<
  Pick<
    ApprovalItem,
    "content" | "status" | "postId" | "postUrl" | "error" | "scheduledAt"
  >
>;

export class ApprovalQueue {
  private readonly dirs: Record<
    "pending" | "approved" | "scheduled" | "history",
    string
  >;

  constructor(baseDir?: string) {
    const base = baseDir ?? join(homedir(), ".indra", "approval");
    this.dirs = {
      pending: join(base, "pending"),
      approved: join(base, "approved"),
      scheduled: join(base, "scheduled"),
      history: join(base, "history"),
    };
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    for (const dir of Object.values(this.dirs)) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private getStatusDir(status: ApprovalStatus): string {
    switch (status) {
      case "pending":
        return this.dirs.pending;
      case "approved":
        return this.dirs.approved;
      case "scheduled":
        return this.dirs.scheduled;
      default:
        return this.dirs.history;
    }
  }

  private getFilePath(id: string, status: ApprovalStatus): string {
    return join(this.getStatusDir(status), `${id}.json`);
  }

  private findItemFile(
    id: string,
  ): { path: string; status: ApprovalStatus } | null {
    for (const status of ALL_STATUSES) {
      const path = this.getFilePath(id, status);
      if (existsSync(path)) {
        return { path, status };
      }
    }
    return null;
  }

  private readItem(path: string): ApprovalItem | null {
    try {
      const data = readFileSync(path, "utf-8");
      return ApprovalItemSchema.parse(JSON.parse(data));
    } catch {
      return null;
    }
  }

  private writeItem(item: ApprovalItem): void {
    const path = this.getFilePath(item.id, item.status);
    writeFileSync(path, JSON.stringify(item, null, 2));
  }

  create(input: CreateApprovalItem): ApprovalItem {
    const now = new Date().toISOString();
    const item: ApprovalItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: input.platform,
      content: input.content,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      prompt: input.prompt,
      metadata: input.metadata,
    };
    this.writeItem(item);
    return item;
  }

  get(id: string): ApprovalItem | null {
    const found = this.findItemFile(id);
    return found ? this.readItem(found.path) : null;
  }

  list(status?: ApprovalStatus): ApprovalItem[] {
    const statuses = status ? [status] : ALL_STATUSES;
    const items: ApprovalItem[] = [];

    for (const s of statuses) {
      const dir = this.getStatusDir(s);
      if (!existsSync(dir)) continue;

      for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        const item = this.readItem(join(dir, file));
        if (item) items.push(item);
      }
    }

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  update(id: string, updates: ItemUpdates): ApprovalItem | null {
    const found = this.findItemFile(id);
    if (!found) return null;

    const item = this.readItem(found.path);
    if (!item) return null;

    const updatedItem: ApprovalItem = {
      ...item,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.status && updates.status !== item.status) {
      unlinkSync(found.path);
    }

    this.writeItem(updatedItem);
    return updatedItem;
  }

  approve(id: string, previousOutcomeId?: string): ApprovalItem | null {
    const result = this.update(id, { status: "approved" });
    if (result) {
      // OutcomeLog (final) 記録
      const outcomeId = crypto.randomUUID();
      const collector = new LogCollector({ sessionId: id });
      const outcomeContent: OutcomeContent = {
        posts: [
          {
            text: result.content.text,
            hashtags: [],
          },
        ],
      };
      collector.addOutcomeLog(
        outcomeId,
        "", // executionIdは承認時には不明
        "xpost",
        "final",
        outcomeContent,
        previousOutcomeId,
        { approvalId: id, status: "approved" },
      );
    }
    return result;
  }

  reject(id: string): ApprovalItem | null {
    return this.update(id, { status: "rejected" });
  }

  markPosted(
    id: string,
    postId: string,
    postUrl: string,
    previousOutcomeId?: string,
  ): ApprovalItem | null {
    const result = this.update(id, { status: "posted", postId, postUrl });
    if (result) {
      // OutcomeLog (final) 記録 - 投稿完了時
      const outcomeId = crypto.randomUUID();
      const collector = new LogCollector({ sessionId: id });
      const outcomeContent: OutcomeContent = {
        posts: [
          {
            text: result.content.text,
            hashtags: [],
          },
        ],
      };
      collector.addOutcomeLog(
        outcomeId,
        "", // executionIdは投稿時には不明
        "xpost",
        "final",
        outcomeContent,
        previousOutcomeId,
        { approvalId: id, status: "posted", postId, postUrl },
      );
    }
    return result;
  }

  markFailed(id: string, error: string): ApprovalItem | null {
    return this.update(id, { status: "failed", error });
  }

  schedule(id: string, scheduledAt: string): ApprovalItem | null {
    return this.update(id, { status: "scheduled", scheduledAt });
  }

  listScheduledDue(): ApprovalItem[] {
    const now = new Date();
    return this.list("scheduled").filter((item) => {
      if (!item.scheduledAt) return false;
      return new Date(item.scheduledAt) <= now;
    });
  }

  delete(id: string): boolean {
    const found = this.findItemFile(id);
    if (!found) return false;
    unlinkSync(found.path);
    return true;
  }
}
