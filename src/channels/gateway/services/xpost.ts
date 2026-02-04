import type { NewsStore } from "../../../capabilities/content/news/index.js";
import type { NewsArticle } from "../../../capabilities/content/news/types.js";
import {
  XOperationsWorkflow,
  type XPostResult,
} from "../../../orchestrator/agents/x-operations/workflow.js";
import type { RunRegistry } from "../../../orchestrator/agents/subagent/index.js";
import { IdempotencyManager } from "../../../orchestrator/agents/x-operations/idempotency.js";
import type { LLMProvider } from "../../../orchestrator/llm/index.js";

export type XpostGenerateResult =
  | { ok: true; article: NewsArticle; runId: string }
  | { ok: false; code: string; message: string };

export interface ContentInput {
  id: string;
  title: string;
  url: string;
  content: string;
  summary?: string;
}

export interface XpostService {
  getArticle: (id: string) => NewsArticle | null;
  generate: (
    articleId: string,
    onCompleted: (result: XPostResult) => void,
    onFailed: (error: unknown) => void,
  ) => XpostGenerateResult;
  generateFromContent: (
    input: ContentInput,
    onCompleted: (result: XPostResult) => void,
    onFailed: (error: unknown) => void,
  ) => { ok: true; runId: string };
}

interface XpostServiceDeps {
  newsStore: NewsStore;
  runRegistry: RunRegistry;
  llmProvider: LLMProvider;
}

export function createXpostService(deps: XpostServiceDeps): XpostService {
  const idempotency = new IdempotencyManager();
  const workflow = new XOperationsWorkflow(deps.runRegistry, idempotency);
  workflow.setLLMProvider(deps.llmProvider);

  return {
    getArticle: (id) => deps.newsStore.getById(id),
    generate(articleId, onCompleted, onFailed) {
      const article = deps.newsStore.getById(articleId);
      if (!article) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: `Article not found: ${articleId}`,
        };
      }

      // 非同期でワークフローを実行
      console.log(`[XpostService] Starting workflow for article: ${articleId}`);
      workflow
        .createPost({
          id: article.id,
          title: article.title,
          url: article.url,
          content: article.body ?? "",
          summary: article.summary ?? undefined,
          publishedAt: article.publishedAt
            ? new Date(article.publishedAt)
            : undefined,
        })
        .then((result) => {
          console.log(`[XpostService] Workflow completed:`, result.success);
          onCompleted(result);
        })
        .catch((error) => {
          console.error(`[XpostService] Workflow error:`, error);
          onFailed(error);
        });

      return { ok: true, article, runId: `pending_${Date.now()}` };
    },
    generateFromContent(input, onCompleted, onFailed) {
      console.log(`[XpostService] Starting workflow from content: ${input.id}`);
      workflow
        .createPost({
          id: input.id,
          title: input.title,
          url: input.url,
          content: input.content,
          summary: input.summary,
        })
        .then((result) => {
          console.log(`[XpostService] Workflow completed:`, result.success);
          onCompleted(result);
        })
        .catch((error) => {
          console.error(`[XpostService] Workflow error:`, error);
          onFailed(error);
        });

      return { ok: true, runId: `pending_${Date.now()}` };
    },
  };
}
