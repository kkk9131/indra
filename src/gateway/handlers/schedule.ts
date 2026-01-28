import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type {
  SchedulerManager,
  CreateTaskParams,
  UpdateTaskParams,
} from "../../scheduler/index.js";

export interface ScheduleHandlerContext {
  schedulerManager: SchedulerManager;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleScheduleList(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const tasks = ctx.schedulerManager.list();
  ctx.sendSuccess(ws, frame.id, { tasks });
}

export function handleScheduleGet(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const task = ctx.schedulerManager.get(id);
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
    const task = ctx.schedulerManager.create(params);
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
    const task = ctx.schedulerManager.update(id, params);
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
  const deleted = ctx.schedulerManager.delete(id);
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
  const task = ctx.schedulerManager.toggle(id, enabled);
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
  ctx.schedulerManager.runNow(id).catch((error) => {
    console.error(`[Gateway] Schedule runNow failed for ${id}:`, error);
  });
}

export function handleScheduleTaskTypes(
  ctx: ScheduleHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const taskTypes = ctx.schedulerManager.taskTypes().map((def) => ({
    type: def.type,
    name: def.name,
    description: def.description,
    defaultCron: def.defaultCron,
  }));
  ctx.sendSuccess(ws, frame.id, { taskTypes });
}
