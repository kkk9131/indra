import { z } from "zod";

/**
 * Agent-related event types:
 * - agent.tool_start: { tool: string; input: unknown; toolUseId: string }
 * - agent.tool_result: { tool: string; result: string; toolUseId: string }
 * - agent.turn_complete: { turnNumber: number }
 *
 * Chat event types:
 * - chat.chunk: { text: string }
 * - chat.done: {}
 */

export const RequestFrameSchema = z.object({
  type: z.literal("req"),
  id: z.string().uuid(),
  method: z.string(),
  params: z.unknown().optional(),
});

export const ResponseFrameSchema = z.object({
  type: z.literal("res"),
  id: z.string().uuid(),
  ok: z.boolean(),
  payload: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export const EventFrameSchema = z.object({
  type: z.literal("event"),
  event: z.string(),
  payload: z.unknown().optional(),
  seq: z.number().optional(),
});

export const FrameSchema = z.union([
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
]);

export type RequestFrame = z.infer<typeof RequestFrameSchema>;
export type ResponseFrame = z.infer<typeof ResponseFrameSchema>;
export type EventFrame = z.infer<typeof EventFrameSchema>;
export type Frame = z.infer<typeof FrameSchema>;

export function createResponse(
  id: string,
  ok: boolean,
  payload?: unknown,
  error?: { code: string; message: string },
): ResponseFrame {
  return { type: "res", id, ok, payload, error };
}

export function createEvent(
  event: string,
  payload?: unknown,
  seq?: number,
): EventFrame {
  return { type: "event", event, payload, seq };
}

export function createRequest(method: string, params?: unknown): RequestFrame {
  return { type: "req", id: crypto.randomUUID(), method, params };
}
