import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import {
  fetchXAccount,
  tweetToArticle,
  type CreateNewsSourceParams,
  type NewsSourceDefinition,
  type NewsSourceStore,
  type NewsStore,
  type UpdateNewsSourceParams,
  type XAccountConfig,
} from "../../news/index.js";

export interface NewsSourceHandlerContext {
  newsSourceStore: NewsSourceStore;
  newsStore: NewsStore;
  broadcast: (event: string, payload: unknown) => void;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleNewsSourceList(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const sources = ctx.newsSourceStore.list();
  ctx.sendSuccess(ws, frame.id, { sources });
}

export function handleNewsSourceGet(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const source = ctx.newsSourceStore.get(id);
  if (!source) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
    return;
  }
  ctx.sendSuccess(ws, frame.id, { source });
}

export function handleNewsSourceCreate(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as CreateNewsSourceParams;
    const source = ctx.newsSourceStore.create(params);
    ctx.sendSuccess(ws, frame.id, { source });
    ctx.broadcast("newsSource.updated", { source });
  } catch (error) {
    ctx.sendError(ws, frame.id, "CREATE_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleNewsSourceUpdate(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const { id, ...params } = frame.params as {
      id: string;
    } & UpdateNewsSourceParams;
    const source = ctx.newsSourceStore.update(id, params);
    if (!source) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
      return;
    }
    ctx.sendSuccess(ws, frame.id, { source });
    ctx.broadcast("newsSource.updated", { source });
  } catch (error) {
    ctx.sendError(ws, frame.id, "UPDATE_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleNewsSourceDelete(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const deleted = ctx.newsSourceStore.delete(id);
  if (!deleted) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
    return;
  }
  ctx.sendSuccess(ws, frame.id, { deleted: true });
  ctx.broadcast("newsSource.deleted", { id });
}

export function handleNewsSourceToggle(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id, enabled } = frame.params as { id: string; enabled: boolean };
  const source = ctx.newsSourceStore.toggle(id, enabled);
  if (!source) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
    return;
  }
  ctx.sendSuccess(ws, frame.id, { source });
  ctx.broadcast("newsSource.updated", { source });
}

export function handleNewsSourceFetchNow(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const source = ctx.newsSourceStore.get(id);

  if (!source) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Source not found: ${id}`);
    return;
  }

  // 即座に開始を返す
  ctx.sendSuccess(ws, frame.id, { status: "started" });

  // バックグラウンドでフェッチ実行
  executeNewsSourceFetch(ctx, source).catch((error) => {
    console.error(`[Gateway] NewsSource fetch failed for ${id}:`, error);
  });
}

async function executeNewsSourceFetch(
  ctx: NewsSourceHandlerContext,
  source: NewsSourceDefinition,
): Promise<void> {
  console.log(`[Gateway] NewsSource fetch started for ${source.name}`);

  try {
    if (source.sourceType === "x-account") {
      const config = source.sourceConfig as XAccountConfig;
      const result = await fetchXAccount(config);
      const articles = result.tweets.map((tweet) => tweetToArticle(tweet));

      if (articles.length > 0) {
        await ctx.newsStore.save(articles);
        ctx.broadcast("news.updated", { articles: ctx.newsStore.list() });
      }

      console.log(
        `[Gateway] Fetched ${articles.length} articles from ${source.name}`,
      );
    }

    const updatedSource = ctx.newsSourceStore.updateLastFetchedAt(source.id);
    if (updatedSource) {
      ctx.broadcast("newsSource.updated", { source: updatedSource });
    }
  } catch (error) {
    console.error(`[Gateway] NewsSource fetch error:`, error);
    throw error;
  }
}
