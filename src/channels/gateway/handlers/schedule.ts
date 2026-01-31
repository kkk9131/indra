import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type {
  CreateTaskParams,
  UpdateTaskParams,
} from "../../../orchestrator/scheduler/index.js";
import type { ScheduleService } from "../services/schedule.js";

export interface ScheduleHandlerContext {
  schedule: ScheduleService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleScheduleList(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const tasks = ctx.schedule.list();
  ctx.sendSuccess(ws, frame.id, { tasks });
}

export function handleScheduleGet(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const task = ctx.schedule.get(id);
  if (!task) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Task not found: ${id}`);
    return;
  }
  ctx.sendSuccess(ws, frame.id, { task });
}

export function handleScheduleCreate(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as CreateTaskParams;
    const task = ctx.schedule.create(params);
    ctx.sendSuccess(ws, frame.id, { task });
  } catch (error) {
    ctx.sendError(ws, frame.id, "CREATE_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleScheduleUpdate(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const { id, ...params } = frame.params as {
      id: string;
    } & UpdateTaskParams;
    const task = ctx.schedule.update(id, params);
    if (!task) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", `Task not found: ${id}`);
      return;
    }
    ctx.sendSuccess(ws, frame.id, { task });
  } catch (error) {
    ctx.sendError(ws, frame.id, "UPDATE_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleScheduleDelete(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const deleted = ctx.schedule.remove(id);
  if (!deleted) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Task not found: ${id}`);
    return;
  }
  ctx.sendSuccess(ws, frame.id, { deleted: true });
}

export function handleScheduleToggle(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id, enabled } = frame.params as { id: string; enabled: boolean };
  const task = ctx.schedule.toggle(id, enabled);
  if (!task) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Task not found: ${id}`);
    return;
  }
  ctx.sendSuccess(ws, frame.id, { task });
}

export function handleScheduleRunNow(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };

  // 即座に「開始しました」を返す
  ctx.sendSuccess(ws, frame.id, { status: "started" });

  // バックグラウンドで実行
  ctx.schedule.runNow(id).catch((error) => {
    console.error(`[Gateway] Schedule runNow failed for ${id}:`, error);
  });
}

export function handleScheduleTaskTypes(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const taskTypes = ctx.schedule.taskTypes().map((def) => ({
    type: def.type,
    name: def.name,
    description: def.description,
    defaultCron: def.defaultCron,
  }));
  ctx.sendSuccess(ws, frame.id, { taskTypes });
}
