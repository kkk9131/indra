import type { NewsScheduler, NewsStore } from "../../news/index.js";
import type { NewsArticle } from "../../news/types.js";

export interface NewsService {
  listArticles: () => NewsArticle[];
  refresh: () => Promise<void>;
}

interface NewsServiceDeps {
  newsStore: NewsStore;
  newsScheduler: NewsScheduler;
}

export function createNewsService(deps: NewsServiceDeps): NewsService {
  return {
    listArticles: () => deps.newsStore.list(),
    refresh: () => deps.newsScheduler.run(),
  };
}
