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
