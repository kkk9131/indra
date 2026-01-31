import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { XPostWorkflowOptions } from "../../../capabilities/social/x/index.js";
import type { XpostService } from "../services/xpost.js";

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
  const { articleId, options } = frame.params as {
    articleId: string;
    options?: XPostWorkflowOptions;
  };

  const result = ctx.xpost.generate(
    articleId,
    options,
    (event) => {
      ctx.broadcast("xpost.progress", { articleId, ...event });
    },
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
  ctx.sendSuccess(ws, frame.id, { status: "started" });
}
