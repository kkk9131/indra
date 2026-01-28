import { z } from "zod";

/** ニュースソースの種類 */
export type NewsSource = "claude-code" | "blog" | "log-analysis";

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
  contentHash?: string | null;
  /** 記事本文（取得できない場合はnull） */
  body: string | null;
  /** サムネイル画像URL（取得できない場合はnull） */
  imageUrl: string | null;
}

/** NewsArticleのZodスキーマ */
export const NewsArticleSchema = z.object({
  id: z.string(),
  source: z.enum(["claude-code", "blog", "log-analysis"]),
  title: z.string(),
  summary: z.string().nullable(),
  url: z.string(), // #report/... 形式も許容
  publishedAt: z.string().nullable(),
  fetchedAt: z.string(),
  contentHash: z.string().nullable().optional(),
  body: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

/** NewsArticle配列のZodスキーマ */
export const NewsArticlesSchema = z.array(NewsArticleSchema);
