import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { AnalyticsScheduler } from "../../analytics/index.js";

export interface AnalyticsHandlerContext {
  analyticsScheduler: AnalyticsScheduler | null;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleAnalyticsRunNow(
  ctx: AnalyticsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  if (!ctx.analyticsScheduler) {
    ctx.sendError(
      ws,
      frame.id,
      "ANALYTICS_NOT_CONFIGURED",
      "Analytics not configured. Set ZAI_API_KEY environment variable.",
    );
    return;
  }

  try {
    ctx.sendSuccess(ws, frame.id, { status: "started" });

    // バックグラウンドで実行
    ctx.analyticsScheduler.run().catch((error) => {
      console.error("[Gateway] Analytics run failed:", error);
    });
  } catch (error) {
    ctx.sendError(ws, frame.id, "ANALYTICS_ERROR", ctx.getErrorMessage(error));
  }
}
