import type { ContentBlock } from "./types.js";

export interface StreamingInputMessage {
  type: "user";
  message: { role: "user"; content: ContentBlock[] };
}

export interface QueuedMessage {
  id: string;
  content: ContentBlock[];
  priority: number;
  timestamp: number;
  status: "pending" | "processing" | "completed" | "cancelled";
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;

  enqueue(content: ContentBlock[], priority = 0): string {
    const id = crypto.randomUUID();
    this.queue.push({
      id,
      content,
      priority,
      timestamp: Date.now(),
      status: "pending",
    });
    this.queue.sort((a, b) => b.priority - a.priority);
    return id;
  }

  cancel(id: string): boolean {
    const msg = this.queue.find((m) => m.id === id);
    if (msg && msg.status === "pending") {
      msg.status = "cancelled";
      return true;
    }
    return false;
  }

  async *processQueue(): AsyncIterable<StreamingInputMessage> {
    this.processing = true;
    while (this.queue.length > 0) {
      const msg = this.queue.shift()!;
      if (msg.status === "cancelled") continue;
      msg.status = "processing";
      yield { type: "user", message: { role: "user", content: msg.content } };
      msg.status = "completed";
    }
    this.processing = false;
  }

  get isProcessing(): boolean {
    return this.processing;
  }

  get pendingCount(): number {
    return this.queue.filter((m) => m.status === "pending").length;
  }

  clear(): void {
    this.queue = [];
    this.processing = false;
  }
}
