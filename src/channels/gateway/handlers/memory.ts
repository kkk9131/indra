import type { WebSocket } from "ws";
import type { RequestFrame } from "../protocol/index.js";
import type { MemoryService } from "../services/memory.js";

interface MemoryHandlerContext {
  memory: MemoryService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

/**
 * memory.search ハンドラー
 */
export async function handleMemorySearch(
  ctx: MemoryHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { query, limit, minScore } = frame.params as {
    query?: string;
    limit?: number;
    minScore?: number;
  };

  if (!query) {
    ctx.sendError(ws, frame.id, "INVALID_PARAMS", "query is required");
    return;
  }

  try {
    const results = await ctx.memory.search(query, { limit, minScore });
    ctx.sendSuccess(ws, frame.id, {
      results: results.map((r) => ({
        content: r.chunk.content,
        filePath: r.chunk.filePath,
        startLine: r.chunk.startLine,
        endLine: r.chunk.endLine,
        score: r.score,
        matchType: r.matchType,
      })),
    });
  } catch (error) {
    ctx.sendError(ws, frame.id, "MEMORY_ERROR", ctx.getErrorMessage(error));
  }
}

/**
 * memory.get ハンドラー
 */
export async function handleMemoryGet(
  ctx: MemoryHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { filePath } = frame.params as { filePath?: string };

  try {
    const content = await ctx.memory.get(filePath);
    ctx.sendSuccess(ws, frame.id, { content, filePath });
  } catch (error) {
    ctx.sendError(ws, frame.id, "MEMORY_ERROR", ctx.getErrorMessage(error));
  }
}

/**
 * memory.write ハンドラー
 */
export async function handleMemoryWrite(
  ctx: MemoryHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { content, filePath, append } = frame.params as {
    content?: string;
    filePath?: string;
    append?: boolean;
  };

  if (!content) {
    ctx.sendError(ws, frame.id, "INVALID_PARAMS", "content is required");
    return;
  }

  try {
    const result = await ctx.memory.write(content, { filePath, append });
    ctx.sendSuccess(ws, frame.id, { message: result });
  } catch (error) {
    ctx.sendError(ws, frame.id, "MEMORY_ERROR", ctx.getErrorMessage(error));
  }
}

/**
 * memory.stats ハンドラー
 */
export function handleMemoryStats(
  ctx: MemoryHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const stats = ctx.memory.getStats();
  ctx.sendSuccess(ws, frame.id, {
    ...stats,
    vectorEnabled: ctx.memory.isVectorEnabled(),
  });
}

/**
 * memory.index ハンドラー
 */
export async function handleMemoryIndex(
  ctx: MemoryHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { filePath, content } = frame.params as {
    filePath?: string;
    content?: string;
  };

  if (!filePath || !content) {
    ctx.sendError(
      ws,
      frame.id,
      "INVALID_PARAMS",
      "filePath and content are required",
    );
    return;
  }

  try {
    const result = await ctx.memory.indexFile(filePath, content);
    ctx.sendSuccess(ws, frame.id, result);
  } catch (error) {
    ctx.sendError(ws, frame.id, "MEMORY_ERROR", ctx.getErrorMessage(error));
  }
}

/**
 * memory.delete ハンドラー
 */
export function handleMemoryDelete(
  ctx: MemoryHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { filePath } = frame.params as { filePath?: string };

  if (!filePath) {
    ctx.sendError(ws, frame.id, "INVALID_PARAMS", "filePath is required");
    return;
  }

  try {
    const deleted = ctx.memory.deleteFile(filePath);
    ctx.sendSuccess(ws, frame.id, { deleted, filePath });
  } catch (error) {
    ctx.sendError(ws, frame.id, "MEMORY_ERROR", ctx.getErrorMessage(error));
  }
}
