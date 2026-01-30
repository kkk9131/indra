import crypto from "node:crypto";

import { query } from "@anthropic-ai/claude-agent-sdk";

import type { NewsArticle, NewsSource } from "./types.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1800000; // 30 minutes

export const ANTHROPIC_SOURCES = {
  blog: "https://www.anthropic.com/news",
  research: "https://www.anthropic.com/research",
  engineering: "https://www.anthropic.com/engineering",
} as const;

export type AnthropicSourceType = keyof typeof ANTHROPIC_SOURCES;

export interface FetchOptions {
  sources?: AnthropicSourceType[];
  translate?: boolean;
}

export async function fetchAnthropicNews(
  options: FetchOptions = {},
): Promise<NewsArticle[]> {
  const { sources = ["blog", "research", "engineering"], translate = false } =
    options;

  try {
    let result: string | undefined;
    const startTime = Date.now();

    const sourcesParam = sources.join(",");
    const prompt = translate
      ? `/anthropic-news-fetch sources=${sourcesParam} translate=true`
      : `/anthropic-news-fetch sources=${sourcesParam}`;

    console.log(`[NewsFetcher] Starting query with: ${prompt}`);

    for await (const message of query({
      prompt,
      options: {
        cwd: process.cwd(),
        settingSources: ["user", "project"],
        allowedTools: ["Skill", "Bash"],
        model: "sonnet",
        maxTurns: 60,
      },
    })) {
      console.log("[NewsFetcher] Message:", JSON.stringify(message, null, 2));

      if (Date.now() - startTime > FETCH_TIMEOUT_MS) {
        console.warn("[NewsFetcher] Timeout after 30 minutes");
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

export function filterLast24Hours(articles: NewsArticle[]): NewsArticle[] {
  const oneDayAgo = Date.now() - ONE_DAY_MS;

  return articles.filter((article) => {
    const dateStr = article.publishedAt ?? article.fetchedAt;
    const timestamp = new Date(dateStr).getTime();
    return timestamp >= oneDayAgo;
  });
}

interface CommandOutput {
  articles: Array<{
    source: string;
    title: string;
    titleJa?: string;
    url: string;
    publishedAt: string;
    summary: string;
    body?: string;
    bodyJa?: string;
    imageUrl?: string;
  }>;
  error?: string;
}

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
        titleJa: article.titleJa || null,
        summary: article.summary || null,
        url: article.url,
        publishedAt,
        fetchedAt,
        contentHash,
        body: article.body || null,
        bodyJa: article.bodyJa || null,
        imageUrl: article.imageUrl || null,
      };
    });
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return [];
  }
}

function mapSource(source: string): NewsSource {
  const normalized = source.toLowerCase();

  if (
    normalized.includes("claude-code") ||
    normalized.includes("claude code")
  ) {
    return "claude-code";
  }

  if (normalized === "research") {
    return "research";
  }

  if (normalized === "engineering") {
    return "engineering";
  }

  return "blog";
}

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

function generateArticleId(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function generateContentHash(
  title: string,
  url: string,
  publishedAt: string | null,
): string {
  const content = `${title}|${url}|${publishedAt || ""}`;
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}
