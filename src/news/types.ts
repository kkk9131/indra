import { z } from "zod";

export type NewsSource = "claude-code" | "blog" | "log-analysis" | "x-account";
export type NewsSourceType = "x-account" | "rss" | "web";

export interface XAccountConfig {
  handle: string;
  maxTweets?: number;
  hoursBack?: number;
  includeRetweets?: boolean;
  includeReplies?: boolean;
}

export interface NewsSourceDefinition {
  id: string;
  name: string;
  sourceType: NewsSourceType;
  sourceConfig: XAccountConfig | Record<string, unknown>;
  enabled: boolean;
  lastFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const XAccountConfigSchema = z.object({
  handle: z.string(),
  maxTweets: z.number().optional(),
  hoursBack: z.number().optional(),
  includeRetweets: z.boolean().optional(),
  includeReplies: z.boolean().optional(),
});

export const NewsSourceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceType: z.enum(["x-account", "rss", "web"]),
  sourceConfig: z.union([XAccountConfigSchema, z.record(z.unknown())]),
  enabled: z.boolean(),
  lastFetchedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface NewsArticle {
  id: string;
  source: NewsSource;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
  contentHash?: string | null;
  body: string | null;
  imageUrl: string | null;
}

export const NewsArticleSchema = z.object({
  id: z.string(),
  source: z.enum(["claude-code", "blog", "log-analysis", "x-account"]),
  title: z.string(),
  summary: z.string().nullable(),
  url: z.string(),
  publishedAt: z.string().nullable(),
  fetchedAt: z.string(),
  contentHash: z.string().nullable().optional(),
  body: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export const NewsArticlesSchema = z.array(NewsArticleSchema);
