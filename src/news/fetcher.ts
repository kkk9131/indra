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
    const timeoutMs = 30000;
    const startTime = Date.now();

    for await (const message of query({
      prompt: "/anthropic-news",
      options: {
        cwd: process.cwd(),
        settingSources: ["user", "project"],
        allowedTools: ["Skill", "WebFetch"],
        model: "haiku",
        maxTurns: 5,
      },
    })) {
      // タイムアウトチェック
      if (Date.now() - startTime > timeoutMs) {
        console.warn("Anthropic news fetch timeout");
        break;
      }

      if (message.type === "result" && message.subtype === "success") {
        result = message.result;
        break;
      }
    }

    if (!result) {
      return [];
    }

    return parseMarkdownToArticles(result);
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

/**
 * Markdown出力をパースしてNewsArticle配列に変換
 * @param markdown スキル出力のMarkdown
 * @returns パース後の記事配列
 */
function parseMarkdownToArticles(markdown: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const fetchedAt = new Date().toISOString();

  try {
    // セクション分割（## Claude Code ドキュメント、## Anthropic ブログ）
    const sections = markdown.split(/^## /m).filter((s) => s.trim());

    for (const section of sections) {
      const source = detectSource(section);
      if (!source) continue;

      // 記事エントリーを抽出
      // 想定フォーマット: "1. **タイトル** (日付)\n   URL: https://..."
      // または: "- **タイトル** (日付)\n  URL: https://..."
      const entryPattern =
        /(?:^\d+\.\s+|-\s+)\*\*(.+?)\*\*\s*(?:\(([^)]+)\))?[\s\S]*?(?:URL:\s*)?(https?:\/\/[^\s)]+)/gim;

      let match;
      while ((match = entryPattern.exec(section)) !== null) {
        const title = match[1]?.trim();
        const dateStr = match[2]?.trim();
        const url = match[3]?.trim();

        if (!title || !url) continue;

        const publishedAt = parseDateString(dateStr);
        const id = generateArticleId(url);
        const contentHash = generateContentHash(title, url, publishedAt);

        articles.push({
          id,
          source,
          title,
          summary: null, // スキル出力から要約は取得しない
          url,
          publishedAt,
          fetchedAt,
          contentHash,
        });
      }
    }

    return articles;
  } catch (error) {
    console.error("Failed to parse markdown:", error);
    return [];
  }
}

/**
 * セクションからニュースソースを判定
 */
function detectSource(section: string): NewsSource | null {
  const firstLine = section.split("\n")[0].toLowerCase();

  const isClaudeCode =
    firstLine.includes("claude code") || firstLine.includes("ドキュメント");
  if (isClaudeCode) {
    return "claude-code";
  }

  const isBlog = firstLine.includes("blog") || firstLine.includes("ブログ");
  if (isBlog) {
    return "blog";
  }

  return null;
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
