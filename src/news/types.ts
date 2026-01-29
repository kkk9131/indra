import { z } from "zod";

export type NewsSource =
  | "claude-code"
  | "blog"
  | "indra-log"
  | "news-report"
  | "x-account"
  | "github-changelog";
export type NewsSourceType = "x-account" | "rss" | "web" | "github";

export interface XAccountConfig {
  handle: string;
  maxTweets?: number;
  hoursBack?: number;
  includeRetweets?: boolean;
  includeReplies?: boolean;
}

export interface GitHubChangelogConfig {
  owner: string;
  repo: string;
  branch?: string;
  filePath?: string;
}

export interface NewsSourceDefinition {
  id: string;
  name: string;
  sourceType: NewsSourceType;
  sourceConfig:
    | XAccountConfig
    | GitHubChangelogConfig
    | Record<string, unknown>;
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

export const GitHubChangelogConfigSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  filePath: z.string().optional(),
});

export const NewsSourceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceType: z.enum(["x-account", "rss", "web", "github"]),
  sourceConfig: z.union([
    XAccountConfigSchema,
    GitHubChangelogConfigSchema,
    z.record(z.unknown()),
  ]),
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
  source: z.enum([
    "claude-code",
    "blog",
    "indra-log",
    "news-report",
    "x-account",
    "github-changelog",
  ]),
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
