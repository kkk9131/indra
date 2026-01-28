import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { NewsScheduler, NewsStore } from "../../news/index.js";

export interface NewsHandlerContext {
  newsStore: NewsStore;
  newsScheduler: NewsScheduler;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
}

export function handleNewsList(
  ctx: NewsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const articles = ctx.newsStore.list();
  ctx.sendSuccess(ws, frame.id, { articles });
}

export function handleNewsRefresh(
  ctx: NewsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  console.log("[Gateway] handleNewsRefresh called");

  // 即座に「開始しました」を返す
  ctx.sendSuccess(ws, frame.id, { status: "started" });

  // バックグラウンドで実行（awaitしない）
  console.log("[Gateway] Starting newsScheduler.run()");
  ctx.newsScheduler.run().catch((error) => {
    console.error("[Gateway] News refresh failed:", error);
  });
}
