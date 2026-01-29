import { existsSync, mkdirSync } from "fs";
import { appendFileSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { homedir } from "os";

export interface TranscriptHeader {
  type: "session";
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
}

export interface TranscriptMessageContent {
  role: "user" | "assistant" | "tool";
  content: unknown[];
  timestamp?: number;
  usage?: { input: number; output: number; totalTokens: number };
}

export interface TranscriptMessage {
  type: "message";
  id: string;
  timestamp: string;
  message: TranscriptMessageContent;
}

export type TranscriptEntry = TranscriptHeader | TranscriptMessage;

const TRANSCRIPT_VERSION = 1;

export class TranscriptManager {
  private baseDir: string;

  constructor(dataDir?: string) {
    this.baseDir = path.join(
      dataDir ?? path.join(homedir(), ".indra"),
      "transcripts",
    );
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getPath(sessionId: string): string {
    return path.join(this.baseDir, `${sessionId}.jsonl`);
  }

  create(sessionId: string, cwd?: string): void {
    const filePath = this.getPath(sessionId);
    const header: TranscriptHeader = {
      type: "session",
      version: TRANSCRIPT_VERSION,
      id: sessionId,
      timestamp: new Date().toISOString(),
      cwd: cwd ?? process.cwd(),
    };
    writeFileSync(filePath, JSON.stringify(header) + "\n", "utf-8");
  }

  append(sessionId: string, msg: TranscriptMessageContent): string {
    const filePath = this.getPath(sessionId);
    const messageId = crypto.randomUUID();
    const entry: TranscriptMessage = {
      type: "message",
      id: messageId,
      timestamp: new Date().toISOString(),
      message: {
        ...msg,
        timestamp: msg.timestamp ?? Date.now(),
      },
    };
    appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
    return messageId;
  }

  read(
    sessionId: string,
    limit?: number,
  ): { header: TranscriptHeader | null; messages: TranscriptMessage[] } {
    const filePath = this.getPath(sessionId);
    if (!existsSync(filePath)) {
      return { header: null, messages: [] };
    }

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    let header: TranscriptHeader | null = null;
    const messages: TranscriptMessage[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as TranscriptEntry;
        if (entry.type === "session") {
          header = entry;
        } else if (entry.type === "message") {
          messages.push(entry);
        }
      } catch {
        // Skip malformed lines
      }
    }

    if (limit && limit > 0) {
      return { header, messages: messages.slice(-limit) };
    }

    return { header, messages };
  }

  exists(sessionId: string): boolean {
    return existsSync(this.getPath(sessionId));
  }

  delete(sessionId: string): boolean {
    const filePath = this.getPath(sessionId);
    if (!existsSync(filePath)) {
      return false;
    }
    try {
      const { unlinkSync } = require("fs");
      unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getLastMessage(sessionId: string): TranscriptMessage | null {
    const { messages } = this.read(sessionId, 1);
    return messages[0] ?? null;
  }

  getUsageStats(sessionId: string): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } {
    const { messages } = this.read(sessionId);
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;

    for (const msg of messages) {
      if (msg.message.usage) {
        inputTokens += msg.message.usage.input;
        outputTokens += msg.message.usage.output;
        totalTokens += msg.message.usage.totalTokens;
      }
    }

    return { inputTokens, outputTokens, totalTokens };
  }
}
