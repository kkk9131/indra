import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { ReportsService } from "../services/reports.js";

export interface ReportsHandlerContext {
  reports: ReportsService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export async function handleReportsList(
  ctx: ReportsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  try {
    const reports = await ctx.reports.listReports();
    ctx.sendSuccess(ws, frame.id, { reports });
  } catch (error) {
    ctx.sendError(ws, frame.id, "REPORTS_ERROR", ctx.getErrorMessage(error));
  }
}

export async function handleReportsGet(
  ctx: ReportsHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { id } = (frame.params ?? {}) as { id?: string };

  if (!id) {
    ctx.sendError(ws, frame.id, "INVALID_PARAMS", "Report ID is required");
    return;
  }

  try {
    const report = await ctx.reports.getReport(id);
    if (!report) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", `Report not found: ${id}`);
      return;
    }
    ctx.sendSuccess(ws, frame.id, { report });
  } catch (error) {
    ctx.sendError(ws, frame.id, "REPORTS_ERROR", ctx.getErrorMessage(error));
  }
}
