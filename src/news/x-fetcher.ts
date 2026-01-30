import type { NewsArticle, XAccountConfig } from "./types.js";

const TITLE_MAX_LENGTH = 100;
const DEFAULT_MAX_TWEETS = 20;

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

function truncateTitle(text: string): string {
  if (text.length <= TITLE_MAX_LENGTH) {
    return text;
  }
  return text.slice(0, TITLE_MAX_LENGTH) + "...";
}

export function tweetToArticle(tweet: XTweet): NewsArticle {
  return {
    id: `x-${tweet.id}`,
    source: "x-account",
    title: truncateTitle(tweet.text),
    titleJa: null,
    summary: tweet.text,
    url: tweet.url,
    publishedAt: tweet.publishedAt,
    fetchedAt: new Date().toISOString(),
    contentHash: `x-${tweet.id}`,
    body: tweet.text,
    bodyJa: null,
    imageUrl: null,
  };
}

export async function fetchXAccount(
  config: XAccountConfig,
): Promise<XFetchResult> {
  const maxTweets = config.maxTweets ?? DEFAULT_MAX_TWEETS;
  console.log(`[XFetcher] Fetching ${config.handle} (max: ${maxTweets})`);

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
