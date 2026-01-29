import type { NewsStore } from "../../news/index.js";
import type { NewsArticle } from "../../news/types.js";
import type {
  XPostWorkflowService,
  XPostProgressEvent,
  XPostWorkflowOptions,
  XPostWorkflowResult,
} from "../../xpost/index.js";

export type XpostGenerateResult =
  | { ok: true; article: NewsArticle }
  | { ok: false; code: string; message: string };

export interface XpostService {
  getArticle: (id: string) => NewsArticle | null;
  generate: (
    articleId: string,
    options: XPostWorkflowOptions | undefined,
    onProgress: (event: XPostProgressEvent) => void,
    onCompleted: (result: XPostWorkflowResult) => void,
    onFailed: (error: unknown) => void,
  ) => XpostGenerateResult;
}

interface XpostServiceDeps {
  newsStore: NewsStore;
  xpostWorkflowService: XPostWorkflowService;
}

export function createXpostService(deps: XpostServiceDeps): XpostService {
  return {
    getArticle: (id) => deps.newsStore.getById(id),
    generate(articleId, options, onProgress, onCompleted, onFailed) {
      const article = deps.newsStore.getById(articleId);
      if (!article) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: `Article not found: ${articleId}`,
        };
      }

      deps.xpostWorkflowService
        .execute(article, options ?? {}, (event) => {
          onProgress(event);
        })
        .then((result) => {
          onCompleted(result);
        })
        .catch((error) => {
          onFailed(error);
        });

      return { ok: true, article };
    },
  };
}
