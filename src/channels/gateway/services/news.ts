import type {
  NewsScheduler,
  NewsStore,
} from "../../../capabilities/content/news/index.js";
import type { NewsArticle } from "../../../capabilities/content/news/types.js";

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
