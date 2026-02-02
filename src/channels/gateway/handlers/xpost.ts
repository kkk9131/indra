import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { XpostService, ContentInput } from "../services/xpost.js";

export interface XpostHandlerContext {
  xpost: XpostService;
  broadcast: (event: string, payload: unknown) => void;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
}

export function handleXpostGenerate(
  ctx: XpostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { articleId } = frame.params as {
    articleId: string;
  };

  const result = ctx.xpost.generate(
    articleId,
    (workflowResult) => {
      ctx.broadcast("xpost.completed", workflowResult);
    },
    (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      ctx.broadcast("xpost.failed", { articleId, error: errorMessage });
    },
  );

  if (!result.ok) {
    ctx.sendError(ws, frame.id, result.code, result.message);
    return;
  }

  // 即座に「開始しました」を返す
  ctx.sendSuccess(ws, frame.id, { status: "started", runId: result.runId });
}

export function handleXpostGenerateFromContent(
  ctx: XpostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const input = frame.params as ContentInput;

  if (!input.id || !input.title || !input.content) {
    ctx.sendError(
      ws,
      frame.id,
      "INVALID_PARAMS",
      "id, title, and content are required",
    );
    return;
  }

  const result = ctx.xpost.generateFromContent(
    input,
    (workflowResult) => {
      ctx.broadcast("xpost.completed", workflowResult);
    },
    (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      ctx.broadcast("xpost.failed", { id: input.id, error: errorMessage });
    },
  );

  ctx.sendSuccess(ws, frame.id, { status: "started", runId: result.runId });
}
