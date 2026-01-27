import { z } from "zod";

/** ニュースソースの種類 */
export type NewsSource = "claude-code" | "blog";

/** ニュース記事 */
export interface NewsArticle {
  /** 一意識別子 */
  id: string;
  /** ソース種別 */
  source: NewsSource;
  /** 記事タイトル */
  title: string;
  /** 要約（取得できない場合はnull） */
  summary: string | null;
  /** 記事URL */
  url: string;
  /** 公開日時 ISO 8601（不明な場合はnull） */
  publishedAt: string | null;
  /** 取得日時 ISO 8601 */
  fetchedAt: string;
  /** コンテンツハッシュ（変更検知用） */
  contentHash?: string;
}

/** NewsArticleのZodスキーマ */
export const NewsArticleSchema = z.object({
  id: z.string(),
  source: z.enum(["claude-code", "blog"]),
  title: z.string(),
  summary: z.string().nullable(),
  url: z.string().url(),
  publishedAt: z.string().nullable(),
  fetchedAt: z.string(),
  contentHash: z.string().optional(),
});

/** NewsArticle配列のZodスキーマ */
export const NewsArticlesSchema = z.array(NewsArticleSchema);
