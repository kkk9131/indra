import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { ApprovalQueue, ApprovalStatus } from "../../approval/index.js";
import type { ConfigManager, Config } from "../../config/index.js";
import { XConnector, type Platform, type Content } from "../../connectors/index.js";
import type { CredentialStore } from "../../auth/index.js";
import type { LLMProvider } from "../../llm/index.js";

export interface PostHandlerContext {
  configManager: ConfigManager;
  approvalQueue: ApprovalQueue;
  credentialStore: CredentialStore;
  xConnector: XConnector | null;
  createLLMProvider: (config: Config["llm"]) => LLMProvider;
  broadcast: (event: string, payload: unknown) => void;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
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
    const config = ctx.configManager.get();
    const provider = ctx.createLLMProvider(config.llm);

    const systemPrompt = `You are a social media content creator. Generate a concise, engaging post for ${platform}.
Keep it under 280 characters. Be creative and natural. Output ONLY the post text, no explanations.`;

    const generatedText = await provider.chat(
      [{ role: "user", content: prompt }],
      { systemPrompt },
    );
    const item = ctx.approvalQueue.create({
      platform,
      content: { text: generatedText.slice(0, 280) },
      prompt,
    });

    ctx.sendSuccess(ws, frame.id, { item });

    // Broadcast to all clients
    ctx.broadcast("post.created", { item });
  } catch (error) {
    ctx.sendError(ws, frame.id, "POST_CREATE_ERROR", ctx.getErrorMessage(error));
  }
}

export function handlePostList(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const params = frame.params as { status?: ApprovalStatus } | undefined;
  ctx.sendSuccess(ws, frame.id, {
    items: ctx.approvalQueue.list(params?.status),
  });
}

export async function handlePostApprove(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const { id } = frame.params as { id: string };

  const item = ctx.approvalQueue.approve(id);
  if (!item) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
    return;
  }

  if (item.platform !== "x") {
    ctx.sendError(
      ws,
      frame.id,
      "UNSUPPORTED_PLATFORM",
      `Platform not yet supported: ${item.platform}`,
    );
    return;
  }

  // Check for OAuth2 credentials first
  const xCreds = ctx.credentialStore.getXCredentials();
  let connector: XConnector;

  if (xCreds && !ctx.credentialStore.isXTokenExpired()) {
    // Use OAuth2 token
    connector = new XConnector({ oauth2AccessToken: xCreds.accessToken });
  } else if (ctx.xConnector) {
    // Fall back to OAuth 1.0a
    connector = ctx.xConnector;
  } else {
    const failedItem = ctx.approvalQueue.markFailed(
      id,
      "X connector not configured",
    );
    ctx.broadcast("post.updated", { item: failedItem });
    ctx.sendError(
      ws,
      frame.id,
      "CONNECTOR_NOT_CONFIGURED",
      "X connector not configured. Authenticate via OAuth 2.0 or set OAuth 1.0a environment variables.",
    );
    return;
  }

  try {
    await connector.connect();
    const result = await connector.post(item.content);

    if (result.success && result.postId && result.url) {
      const postedItem = ctx.approvalQueue.markPosted(
        id,
        result.postId,
        result.url,
      );
      ctx.sendSuccess(ws, frame.id, { item: postedItem });
      ctx.broadcast("post.updated", { item: postedItem });
    } else {
      const failedItem = ctx.approvalQueue.markFailed(
        id,
        result.error ?? "Unknown error",
      );
      ctx.broadcast("post.updated", { item: failedItem });
      ctx.sendError(
        ws,
        frame.id,
        "POST_FAILED",
        result.error ?? "Failed to post",
      );
    }
  } catch (error) {
    const failedItem = ctx.approvalQueue.markFailed(
      id,
      ctx.getErrorMessage(error),
    );
    ctx.broadcast("post.updated", { item: failedItem });
    ctx.sendError(ws, frame.id, "POST_ERROR", ctx.getErrorMessage(error));
  }
}

export function handlePostReject(
  ctx: PostHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { id } = frame.params as { id: string };
  const item = ctx.approvalQueue.reject(id);

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
  const item = ctx.approvalQueue.update(id, { content });

  if (!item) {
    ctx.sendError(ws, frame.id, "NOT_FOUND", `Item not found: ${id}`);
    return;
  }

  ctx.sendSuccess(ws, frame.id, { item });
  ctx.broadcast("post.updated", { item });
}
