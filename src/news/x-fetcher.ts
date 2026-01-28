import type { NewsArticle, XAccountConfig } from "./types.js";

export interface XTweet {
  id: string;
  text: string;
  url: string;
  publishedAt: string;
  authorHandle: string;
  authorName: string;
  isRetweet: boolean;
  isReply: boolean;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface XFetchResult {
  tweets: XTweet[];
  fetchedAt: string;
}

export function tweetToArticle(tweet: XTweet): NewsArticle {
  const title =
    tweet.text.length > 100 ? tweet.text.slice(0, 100) + "..." : tweet.text;

  return {
    id: `x-${tweet.id}`,
    source: "x-account",
    title,
    summary: tweet.text,
    url: tweet.url,
    publishedAt: tweet.publishedAt,
    fetchedAt: new Date().toISOString(),
    contentHash: `x-${tweet.id}`,
    body: tweet.text,
    imageUrl: null,
  };
}

/**
 * Xアカウントからツイートを取得
 * TODO: agent-browserスキルを使用した実装
 */
export async function fetchXAccount(
  config: XAccountConfig,
): Promise<XFetchResult> {
  console.log(
    `[XFetcher] Fetching ${config.handle} (max: ${config.maxTweets ?? 20})`,
  );

  return {
    tweets: [],
    fetchedAt: new Date().toISOString(),
  };
}

export function filterTweetsByTime(
  tweets: XTweet[],
  hoursBack: number | undefined,
): XTweet[] {
  if (!hoursBack || hoursBack <= 0) {
    return tweets;
  }

  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

  return tweets.filter((tweet) => new Date(tweet.publishedAt) >= cutoffTime);
}

export function filterTweetsByType(
  tweets: XTweet[],
  includeRetweets: boolean,
  includeReplies: boolean,
): XTweet[] {
  return tweets.filter((tweet) => {
    if (!includeRetweets && tweet.isRetweet) return false;
    if (!includeReplies && tweet.isReply) return false;
    return true;
  });
}

export async function fetchXAccounts(
  configs: Array<{ config: XAccountConfig }>,
): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  for (const { config } of configs) {
    try {
      const result = await fetchXAccount(config);
      const converted = result.tweets.map((tweet) => tweetToArticle(tweet));
      articles.push(...converted);
    } catch (error) {
      console.error(`[XFetcher] Error fetching ${config.handle}:`, error);
    }
  }

  return articles;
}
