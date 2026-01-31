import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { AnalyticsService } from "../services/analytics.js";

export interface AnalyticsHandlerContext {
  analytics: AnalyticsService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleAnalyticsRunNow(
  ctx: AnalyticsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const result = ctx.analytics.runNow();
    if (!result.ok) {
      ctx.sendError(ws, frame.id, result.code, result.message);
      return;
    }

    ctx.sendSuccess(ws, frame.id, { status: "started" });
  } catch (error) {
    ctx.sendError(ws, frame.id, "ANALYTICS_ERROR", ctx.getErrorMessage(error));
  }
}
