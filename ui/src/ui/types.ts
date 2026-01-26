// Phase 3 UI Types

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
