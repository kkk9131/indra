import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { AuthService } from "../services/auth.js";

export interface AuthHandlerContext {
  auth: AuthService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
}

export function handleAuthXStart(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const result = ctx.auth.startXAuth();
  if (!result.ok) {
    ctx.sendError(ws, frame.id, result.code, result.message);
    return;
  }

  ctx.sendSuccess(ws, frame.id, { url: result.url, state: result.state });
}

export async function handleAuthXCallback(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { code, state } = frame.params as { code: string; state: string };
  const result = await ctx.auth.handleXCallback(code, state);

  if (!result.ok) {
    ctx.sendError(ws, frame.id, result.code, result.message);
    return;
  }

  ctx.sendSuccess(ws, frame.id, { success: true, username: result.username });
}

export function handleAuthXStatus(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  ctx.sendSuccess(ws, frame.id, ctx.auth.getXStatus());
}

export function handleAuthXLogout(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  ctx.auth.logoutX();
  ctx.sendSuccess(ws, frame.id, { success: true });
}

export function handleAuthDiscordStatus(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  ctx.sendSuccess(ws, frame.id, ctx.auth.getDiscordStatus());
}
