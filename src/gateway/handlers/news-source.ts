import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type {
  CreateNewsSourceParams,
  UpdateNewsSourceParams,
} from "../../news/index.js";
import type { NewsSourceService } from "../services/news-source.js";

export interface NewsSourceHandlerContext {
  newsSource: NewsSourceService;
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
  const sources = ctx.newsSource.list();
  ctx.sendSuccess(ws, frame.id, { sources });
}

export function handleNewsSourceGet(
  ctx: NewsSourceHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const source = ctx.newsSource.get(id);
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
    const source = ctx.newsSource.create(params);
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
    const source = ctx.newsSource.update(id, params);
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
  const deleted = ctx.newsSource.remove(id);
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
  const source = ctx.newsSource.toggle(id, enabled);
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
  const source = ctx.newsSource.get(id);

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
  source: Parameters<NewsSourceService["fetchNow"]>[0],
): Promise<void> {
  console.log(`[Gateway] NewsSource fetch started for ${source.name}`);

  try {
    const result = await ctx.newsSource.fetchNow(source);
    if (result.allArticles.length > 0) {
      ctx.broadcast("news.updated", { articles: result.allArticles });
      console.log(
        `[Gateway] Fetched ${result.articles.length} articles from ${source.name}`,
      );
    }

    if (result.updatedSource) {
      ctx.broadcast("newsSource.updated", { source: result.updatedSource });
    }
  } catch (error) {
    console.error(`[Gateway] NewsSource fetch error:`, error);
    throw error;
  }
}
