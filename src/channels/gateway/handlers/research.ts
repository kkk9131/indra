import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import { researchWorkflow } from "../../../orchestrator/agents/research/index.js";

export interface ResearchHandlerContext {
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

interface ResearchCreateParams {
  topic: string;
  depth?: "quick" | "normal" | "deep";
  language?: "ja" | "en";
}

export async function handleResearchCreate(
  ctx: ResearchHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const {
    topic,
    depth = "normal",
    language = "ja",
  } = (frame.params as ResearchCreateParams) ?? {};

  if (!topic) {
    ctx.sendError(ws, frame.id, "INVALID_PARAMS", "topic is required");
    return;
  }

  try {
    const result = await researchWorkflow.execute({ topic, depth, language });
    ctx.sendSuccess(ws, frame.id, {
      success: result.success,
      runId: result.runId,
      outputPath: result.outputPath,
      error: result.error,
    });
  } catch (error) {
    ctx.sendError(ws, frame.id, "RESEARCH_ERROR", ctx.getErrorMessage(error));
  }
}
