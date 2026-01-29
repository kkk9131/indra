import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { NewsStore } from "../../news/index.js";
import type {
  XPostWorkflowService,
  XPostProgressEvent,
  XPostWorkflowOptions,
} from "../../xpost/index.js";

export interface XpostHandlerContext {
  newsStore: NewsStore;
  xpostWorkflowService: XPostWorkflowService;
  broadcast: (event: string, payload: unknown) => void;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
}

export function handleXpostGenerate(
  ctx: XpostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { articleId, options } = frame.params as {
    articleId: string;
    options?: XPostWorkflowOptions;
  };

  const article = ctx.newsStore.getById(articleId);
  if (!article) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Article not found: ${articleId}`);
    return;
  }

  // 即座に「開始しました」を返す
  ctx.sendSuccess(ws, frame.id, { status: "started" });

  // バックグラウンドで実行、進捗はbroadcast
  ctx.xpostWorkflowService
    .execute(article, options ?? {}, (event: XPostProgressEvent) => {
      ctx.broadcast("xpost.progress", { articleId, ...event });
    })
    .then((result) => {
      ctx.broadcast("xpost.completed", result);
    })
    .catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      ctx.broadcast("xpost.failed", { articleId, error: errorMessage });
    });
}
