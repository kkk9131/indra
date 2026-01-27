// Phase 3 UI Types
import type { ApprovalItem } from "../services/ws-client.js";

export type Platform =
  | "x"
  | "note"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "other";

export type ContentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "posted"
  | "scheduled";

export interface Content {
  id: string;
  platform: Platform;
  accountId: string;
  text: string;
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Convert backend ApprovalItem to UI Content
 */
export function approvalItemToContent(item: ApprovalItem): Content {
  return {
    id: item.id,
    platform: item.platform as Platform,
    accountId: "default", // Backend doesn't track accountId yet
    text: item.content.text,
    status: item.status as ContentStatus,
    createdAt: new Date(item.createdAt).getTime(),
    updatedAt: new Date(item.updatedAt).getTime(),
    metadata: {
      prompt: item.prompt,
      postId: item.postId,
      postUrl: item.postUrl,
      error: item.error,
    },
  };
}

/**
 * Convert UI Content to backend Content format
 */
export function contentToApprovalContent(content: Content): { text: string } {
  return {
    text: content.text,
  };
}

export interface Account {
  id: string;
  platform: Platform;
  accountName: string;
  displayName?: string;
  status: "active" | "expired" | "error";
  contentCount: number;
  lastPostedAt?: number;
}

export interface ApiToken {
  id: string;
  name: string;
  token: string;
  isActive: boolean;
  lastUsedAt?: number;
  createdAt: number;
}

// Re-export news types from ws-client for consistency
export type { NewsArticle } from "../services/ws-client.js";
export type NewsSource = "claude-code" | "blog";

// Log types - these mirror the backend types in src/logs/types.ts
// Keeping separate to avoid cross-package dependencies
export type LogType = "agent" | "prompt" | "system";
export type AgentActionType =
  | "text"
  | "tool_start"
  | "tool_result"
  | "turn_complete"
  | "done";

export interface LogEntry {
  id: string;
  type: LogType;
  timestamp: string;
  sessionId?: string;
  agentAction?: AgentActionType;
  tool?: string;
  toolInput?: unknown;
  toolResult?: string;
  turnNumber?: number;
  text?: string;
  prompt?: string;
  response?: string;
  model?: string;
  level?: "info" | "warn" | "error";
  message?: string;
}

export type LogSortOrder = "newest" | "oldest";

/** Format a log entry for JSON export */
export function formatLogForExport(log: LogEntry): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: log.type,
    timestamp: log.timestamp,
  };

  switch (log.type) {
    case "agent":
      base.action = log.agentAction;
      if (log.tool) base.tool = log.tool;
      if (log.toolInput) base.input = log.toolInput;
      if (log.toolResult) base.result = log.toolResult;
      if (log.text) base.text = log.text;
      if (log.sessionId) base.session = log.sessionId;
      if (log.turnNumber !== undefined) base.turn = log.turnNumber;
      break;
    case "prompt":
      if (log.prompt) base.prompt = log.prompt;
      if (log.response) base.response = log.response;
      if (log.model) base.model = log.model;
      break;
    case "system":
      if (log.level) base.level = log.level;
      if (log.message) base.message = log.message;
      break;
  }

  return base;
}
