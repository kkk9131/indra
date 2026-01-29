import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { ApprovalStatus } from "../../approval/index.js";
import type { Platform, Content } from "../../connectors/index.js";
import type { PostService } from "../services/post.js";

export interface PostHandlerContext {
  post: PostService;
  broadcast: (event: string, payload: unknown) => void;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
}

export async function handlePostCreate(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  try {
    const { platform, prompt } = frame.params as {
      platform: Platform;
      prompt: string;
    };
    const item = await ctx.post.createDraft(platform, prompt);

    ctx.sendSuccess(ws, frame.id, { item });

    // Broadcast to all clients
    ctx.broadcast("post.created", { item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.sendError(ws, frame.id, "POST_CREATE_ERROR", message);
  }
}

export function handlePostList(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const params = frame.params as { status?: ApprovalStatus } | undefined;
  ctx.sendSuccess(ws, frame.id, {
    items: ctx.post.list(params?.status),
  });
}

export async function handlePostApprove(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { id } = frame.params as { id: string };

  const result = await ctx.post.approve(id);

  if (result.ok) {
    ctx.sendSuccess(ws, frame.id, { item: result.item });
    ctx.broadcast("post.updated", { item: result.item });
    return;
  }

  if (result.item) {
    ctx.broadcast("post.updated", { item: result.item });
  }

  ctx.sendError(ws, frame.id, result.code, result.message);
}

export function handlePostReject(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const item = ctx.post.reject(id);

  if (!item) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
    return;
  }

  ctx.sendSuccess(ws, frame.id, { item });
  ctx.broadcast("post.updated", { item });
}

export function handlePostEdit(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id, content } = frame.params as { id: string; content: Content };
  const item = ctx.post.edit(id, content);

  if (!item) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
    return;
  }

  ctx.sendSuccess(ws, frame.id, { item });
  ctx.broadcast("post.updated", { item });
}
