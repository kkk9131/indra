import {
  fetchXAccount,
  tweetToArticle,
  fetchGitHubChangelog,
  type CreateNewsSourceParams,
  type NewsSourceDefinition,
  type NewsSourceStore,
  type NewsStore,
  type UpdateNewsSourceParams,
  type XAccountConfig,
  type GitHubChangelogConfig,
} from "../../../capabilities/content/news/index.js";
import type { NewsArticle } from "../../../capabilities/content/news/types.js";

export interface NewsSourceFetchResult {
  articles: NewsArticle[];
  allArticles: NewsArticle[];
  updatedSource: NewsSourceDefinition | null;
}

export interface NewsSourceService {
  list: () => NewsSourceDefinition[];
  get: (id: string) => NewsSourceDefinition | null;
  create: (params: CreateNewsSourceParams) => NewsSourceDefinition;
  update: (
    id: string,
    params: UpdateNewsSourceParams,
  ) => NewsSourceDefinition | null;
  remove: (id: string) => boolean;
  toggle: (id: string, enabled: boolean) => NewsSourceDefinition | null;
  fetchNow: (source: NewsSourceDefinition) => Promise<NewsSourceFetchResult>;
}

interface NewsSourceServiceDeps {
  newsSourceStore: NewsSourceStore;
  newsStore: NewsStore;
}

export function createNewsSourceService(
  deps: NewsSourceServiceDeps,
): NewsSourceService {
  return {
    list: () => deps.newsSourceStore.list(),
    get: (id) => deps.newsSourceStore.get(id),
    create: (params) => deps.newsSourceStore.create(params),
    update: (id, params) => deps.newsSourceStore.update(id, params),
    remove: (id) => deps.newsSourceStore.delete(id),
    toggle: (id, enabled) => deps.newsSourceStore.toggle(id, enabled),
    async fetchNow(source) {
      let articles: NewsArticle[] = [];

      switch (source.sourceType) {
        case "x-account": {
          const config = source.sourceConfig as XAccountConfig;
          const result = await fetchXAccount(config);
          articles = result.tweets.map((tweet) => tweetToArticle(tweet));
          break;
        }
        case "github": {
          const config = source.sourceConfig as GitHubChangelogConfig;
          articles = await fetchGitHubChangelog(config);
          break;
        }
        default:
          return { articles: [], allArticles: [], updatedSource: null };
      }

      let allArticles: NewsArticle[] = [];
      if (articles.length > 0) {
        await deps.newsStore.save(articles);
        allArticles = deps.newsStore.list();
      }

      const updatedSource = deps.newsSourceStore.updateLastFetchedAt(source.id);
      return { articles, allArticles, updatedSource: updatedSource ?? null };
    },
  };
}
