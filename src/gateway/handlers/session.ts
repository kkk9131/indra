import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { SessionService } from "../services/session.js";

export interface SessionHandlerContext {
  session: SessionService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleSessionsList(
  ctx: SessionHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { type?: "cli" | "web" } | undefined;
    const sessions = ctx.session.list(params?.type);
    ctx.sendSuccess(ws, frame.id, { sessions });
  } catch (error) {
    ctx.sendError(ws, frame.id, "SESSION_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleSessionsGet(
  ctx: SessionHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { id: string };
    const session = ctx.session.get(params.id);
    if (!session) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", "Session not found");
      return;
    }
    ctx.sendSuccess(ws, frame.id, { session });
  } catch (error) {
    ctx.sendError(ws, frame.id, "SESSION_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleSessionsCreate(
  ctx: SessionHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { title?: string } | undefined;
    const session = ctx.session.create(params?.title);
    ctx.sendSuccess(ws, frame.id, { session });
  } catch (error) {
    ctx.sendError(ws, frame.id, "SESSION_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleSessionsDelete(
  ctx: SessionHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { id: string };
    const deleted = ctx.session.delete(params.id);
    ctx.sendSuccess(ws, frame.id, { deleted });
  } catch (error) {
    ctx.sendError(ws, frame.id, "SESSION_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleSessionsUpdateTitle(
  ctx: SessionHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { id: string; title: string };
    ctx.session.updateTitle(params.id, params.title);
    const session = ctx.session.get(params.id);
    ctx.sendSuccess(ws, frame.id, { session });
  } catch (error) {
    ctx.sendError(ws, frame.id, "SESSION_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleChatHistory(
  ctx: SessionHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { sessionId: string; limit?: number };
    const history = ctx.session.getHistory(params.sessionId, params.limit);
    ctx.sendSuccess(ws, frame.id, history);
  } catch (error) {
    ctx.sendError(ws, frame.id, "SESSION_ERROR", ctx.getErrorMessage(error));
  }
}
