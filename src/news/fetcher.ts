import crypto from "node:crypto";

import { query } from "@anthropic-ai/claude-agent-sdk";

import type { NewsArticle, NewsSource } from "./types.js";

/**
 * Anthropicニュースをスキル経由で取得
 * @returns ニュース記事配列
 */
export async function fetchAnthropicNews(): Promise<NewsArticle[]> {
  try {
    let result: string | undefined;
    const timeoutMs = 600000; // 10分（agent-browser用）
    const startTime = Date.now();

    console.log("[NewsFetcher] Starting query with /anthropic-news-fetch");

    for await (const message of query({
      prompt: "/anthropic-news-fetch",
      options: {
        cwd: process.cwd(),
        settingSources: ["user", "project"],
        allowedTools: ["Skill", "Bash"],
        model: "sonnet",
        maxTurns: 30, // agent-browser操作用
      },
    })) {
      // すべてのメッセージをログ出力
      console.log("[NewsFetcher] Message:", JSON.stringify(message, null, 2));

      // タイムアウトチェック
      if (Date.now() - startTime > timeoutMs) {
        console.warn("[NewsFetcher] Timeout after 10 minutes");
        break;
      }

      if (message.type === "result") {
        const subtype = (message as { subtype?: string }).subtype;
        if (subtype === "success") {
          console.log("[NewsFetcher] Got success result");
          result = (message as { result?: string }).result;
          break;
        } else {
          console.error("[NewsFetcher] Got non-success result:", subtype);
          break;
        }
      }
    }

    console.log(
      "[NewsFetcher] Query finished, result:",
      result ? "got data" : "no data",
    );

    if (!result) {
      return [];
    }

    return parseJsonToArticles(result);
  } catch (error) {
    console.error("Failed to fetch Anthropic news:", error);
    return [];
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 直近24時間の記事のみフィルタ
 * @param articles ニュース記事配列
 * @returns フィルタ後の記事配列
 */
export function filterLast24Hours(articles: NewsArticle[]): NewsArticle[] {
  const oneDayAgo = Date.now() - ONE_DAY_MS;

  return articles.filter((article) => {
    const dateStr = article.publishedAt ?? article.fetchedAt;
    const timestamp = new Date(dateStr).getTime();
    return timestamp >= oneDayAgo;
  });
}

/** コマンド出力のJSON型定義 */
interface CommandOutput {
  articles: Array<{
    source: string;
    title: string;
    url: string;
    publishedAt: string;
    summary: string;
    body?: string;
    imageUrl?: string;
  }>;
  error?: string;
}

/**
 * JSON出力をパースしてNewsArticle配列に変換
 * @param output コマンド出力（JSON形式）
 * @returns パース後の記事配列
 */
function parseJsonToArticles(output: string): NewsArticle[] {
  const fetchedAt = new Date().toISOString();

  try {
    // JSON部分を抽出（前後の説明文を除去）
    const jsonMatch = output.match(/\{[\s\S]*"articles"[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("No JSON found in command output");
      return [];
    }

    const parsed: CommandOutput = JSON.parse(jsonMatch[0]);

    if (parsed.error) {
      console.warn("Command returned error:", parsed.error);
    }

    if (!parsed.articles || !Array.isArray(parsed.articles)) {
      return [];
    }

    return parsed.articles.map((article) => {
      const source = mapSource(article.source);
      const publishedAt = parseDateString(article.publishedAt);
      const id = generateArticleId(article.url);
      const contentHash = generateContentHash(
        article.title,
        article.url,
        publishedAt,
      );

      return {
        id,
        source,
        title: article.title,
        summary: article.summary || null,
        url: article.url,
        publishedAt,
        fetchedAt,
        contentHash,
        body: article.body || null,
        imageUrl: article.imageUrl || null,
      };
    });
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return [];
  }
}

/**
 * ソース文字列をNewsSourceにマッピング
 */
function mapSource(source: string): NewsSource {
  const normalized = source.toLowerCase();

  if (
    normalized.includes("claude-code") ||
    normalized.includes("claude code")
  ) {
    return "claude-code";
  }

  return "blog";
}

/**
 * 日付文字列をISO 8601形式にパース
 * @param dateStr 日付文字列（例: "2025-01-20", "Jan 20, 2025"）
 * @returns ISO 8601形式の日付文字列またはnull
 */
function parseDateString(dateStr: string | undefined): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * 記事IDを生成（URLのハッシュ）
 */
function generateArticleId(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/**
 * コンテンツハッシュを生成（変更検知用）
 */
function generateContentHash(
  title: string,
  url: string,
  publishedAt: string | null,
): string {
  const content = `${title}|${url}|${publishedAt || ""}`;
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}
