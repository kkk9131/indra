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

const ALL_STATUSES: readonly ApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "posted",
];

type ItemUpdates = Partial<
  Pick<ApprovalItem, "content" | "status" | "postId" | "postUrl" | "error">
>;

export class ApprovalQueue {
  private readonly dirs: Record<"pending" | "approved" | "history", string>;

  constructor(baseDir?: string) {
    const base = baseDir ?? join(homedir(), ".indra", "approval");
    this.dirs = {
      pending: join(base, "pending"),
      approved: join(base, "approved"),
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
    if (status === "pending") return this.dirs.pending;
    if (status === "approved") return this.dirs.approved;
    return this.dirs.history;
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

  approve(id: string): ApprovalItem | null {
    return this.update(id, { status: "approved" });
  }

  reject(id: string): ApprovalItem | null {
    return this.update(id, { status: "rejected" });
  }

  markPosted(id: string, postId: string, postUrl: string): ApprovalItem | null {
    return this.update(id, { status: "posted", postId, postUrl });
  }

  markFailed(id: string, error: string): ApprovalItem | null {
    return this.update(id, { error });
  }

  delete(id: string): boolean {
    const found = this.findItemFile(id);
    if (!found) return false;
    unlinkSync(found.path);
    return true;
  }
}
