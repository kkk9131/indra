import type { WebSocket } from "ws";
import type { RequestFrame } from "../protocol/index.js";
import type { DevlogService } from "../services/devlog.js";
import type { DevlogListParams } from "../../../capabilities/devlog/types.js";

export interface DevlogHandlerContext {
  devlog: DevlogService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleDevlogList(
  ctx: DevlogHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as DevlogListParams | undefined;
    const devlogs = ctx.devlog.list(params);
    ctx.sendSuccess(ws, frame.id, { devlogs });
  } catch (error) {
    ctx.sendError(
      ws,
      frame.id,
      "DEVLOG_LIST_ERROR",
      ctx.getErrorMessage(error),
    );
  }
}
