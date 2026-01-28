import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { LogStore } from "../../logs/index.js";

export interface LogsHandlerContext {
  logStore: LogStore;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleLogsList(
  ctx: LogsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const logs = ctx.logStore.list();
  ctx.sendSuccess(ws, frame.id, { logs });
}

export function handleLogsRefresh(
  ctx: LogsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const logs = ctx.logStore.list();
    ctx.sendSuccess(ws, frame.id, { logs });
  } catch (error) {
    ctx.sendError(ws, frame.id, "LOGS_REFRESH_ERROR", ctx.getErrorMessage(error));
  }
}
