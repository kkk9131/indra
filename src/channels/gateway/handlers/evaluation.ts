import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { EvaluationService } from "../services/evaluation.js";
import type { CreateTaskInput } from "../../../orchestrator/evaluation/types.js";
import { CreateTaskInputSchema } from "../../../orchestrator/evaluation/types.js";
import { DEFAULT_K } from "../../../orchestrator/evaluation/index.js";

interface EvaluationContext {
  evaluation: EvaluationService;
  sendSuccess: (ws: WebSocket, id: string, payload: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

// ===== Task Handlers =====

export function handleEvalTaskList(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as
      | { type?: string; withMetrics?: boolean; k?: number }
      | undefined;
    const k = params?.k ?? DEFAULT_K;

    let tasks;
    if (params?.withMetrics) {
      tasks = ctx.evaluation.listTasksWithMetrics(k);
    } else if (params?.type) {
      tasks = ctx.evaluation.listTasksByType(params.type);
    } else {
      tasks = ctx.evaluation.listTasks();
    }

    ctx.sendSuccess(ws, frame.id, { tasks });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleEvalTaskGet(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { id: string; k?: number } | undefined;
    if (!params?.id) {
      ctx.sendError(ws, frame.id, "INVALID_PARAMS", "Task ID is required");
      return;
    }

    const task = ctx.evaluation.getTask(params.id);
    if (!task) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", `Task not found: ${params.id}`);
      return;
    }

    const k = params.k ?? DEFAULT_K;
    const metrics = ctx.evaluation.getTaskMetrics(params.id, k);
    const trials = ctx.evaluation.listTrialsByTask(params.id);

    ctx.sendSuccess(ws, frame.id, { task, metrics, trials });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleEvalTaskCreate(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as CreateTaskInput | undefined;
    const parsed = CreateTaskInputSchema.safeParse(params);
    if (!parsed.success) {
      ctx.sendError(ws, frame.id, "INVALID_PARAMS", parsed.error.message);
      return;
    }

    const task = ctx.evaluation.createTask(parsed.data);
    ctx.sendSuccess(ws, frame.id, { task });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleEvalTaskUpdate(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as
      | ({ id: string } & Partial<CreateTaskInput>)
      | undefined;
    if (!params?.id) {
      ctx.sendError(ws, frame.id, "INVALID_PARAMS", "Task ID is required");
      return;
    }

    const { id, ...updates } = params;
    const task = ctx.evaluation.updateTask(id, updates);
    if (!task) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", `Task not found: ${id}`);
      return;
    }

    ctx.sendSuccess(ws, frame.id, { task });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleEvalTaskDelete(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { id: string } | undefined;
    if (!params?.id) {
      ctx.sendError(ws, frame.id, "INVALID_PARAMS", "Task ID is required");
      return;
    }

    const deleted = ctx.evaluation.deleteTask(params.id);
    if (!deleted) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", `Task not found: ${params.id}`);
      return;
    }

    ctx.sendSuccess(ws, frame.id, { deleted: true });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

// ===== Trial Handlers =====

export function handleEvalTrialList(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { taskId: string } | undefined;
    if (!params?.taskId) {
      ctx.sendError(ws, frame.id, "INVALID_PARAMS", "Task ID is required");
      return;
    }

    const trials = ctx.evaluation.listTrialsByTask(params.taskId);
    ctx.sendSuccess(ws, frame.id, { trials });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleEvalTrialGet(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { id: string } | undefined;
    if (!params?.id) {
      ctx.sendError(ws, frame.id, "INVALID_PARAMS", "Trial ID is required");
      return;
    }

    const trial = ctx.evaluation.getTrialWithResults(params.id);
    if (!trial) {
      ctx.sendError(ws, frame.id, "NOT_FOUND", `Trial not found: ${params.id}`);
      return;
    }

    ctx.sendSuccess(ws, frame.id, { trial });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

// ===== Grading Handlers =====

export async function handleEvalRun(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  try {
    const params = frame.params as
      | {
          taskId: string;
          outcome: string;
          executionId?: string;
          sessionId?: string;
          outcomeId?: string;
        }
      | undefined;

    if (!params?.taskId || !params?.outcome) {
      ctx.sendError(
        ws,
        frame.id,
        "INVALID_PARAMS",
        "Task ID and outcome are required",
      );
      return;
    }

    if (!ctx.evaluation.isGraderAvailable()) {
      ctx.sendError(
        ws,
        frame.id,
        "GRADER_UNAVAILABLE",
        "GLM grader is not available. Please set ZAI_API_KEY.",
      );
      return;
    }

    const result = await ctx.evaluation.runGrading(
      params.taskId,
      params.outcome,
      params.executionId,
      params.sessionId,
      params.outcomeId,
    );

    ctx.sendSuccess(ws, frame.id, result);
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

// ===== Metrics Handlers =====

export function handleEvalMetrics(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const params = frame.params as { taskId: string; k?: number } | undefined;
    if (!params?.taskId) {
      ctx.sendError(ws, frame.id, "INVALID_PARAMS", "Task ID is required");
      return;
    }

    const k = params.k ?? DEFAULT_K;
    const metrics = ctx.evaluation.getTaskMetrics(params.taskId, k);
    if (!metrics) {
      ctx.sendError(
        ws,
        frame.id,
        "NOT_FOUND",
        `Task not found: ${params.taskId}`,
      );
      return;
    }

    ctx.sendSuccess(ws, frame.id, { metrics });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}

export function handleEvalGraderStatus(
  ctx: EvaluationContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  try {
    const available = ctx.evaluation.isGraderAvailable();
    ctx.sendSuccess(ws, frame.id, { available });
  } catch (error) {
    ctx.sendError(ws, frame.id, "EVAL_ERROR", ctx.getErrorMessage(error));
  }
}
