import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { CredentialStore, XOAuth2Handler } from "../../auth/index.js";
import type { XConnector } from "../../connectors/index.js";
import type { DiscordBot } from "../../discord/index.js";

export interface AuthHandlerContext {
  credentialStore: CredentialStore;
  xOAuth2Handler: XOAuth2Handler | null;
  xConnector: XConnector | null;
  discordBot: DiscordBot | null;
  isDiscordBotReady: () => boolean;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

export function handleAuthXStart(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  if (!ctx.xOAuth2Handler) {
    ctx.sendError(
      ws,
      frame.id,
      "OAUTH_NOT_CONFIGURED",
      "X OAuth 2.0 not configured. Set X_CLIENT_ID environment variable.",
    );
    return;
  }

  const { url, state } = ctx.xOAuth2Handler.generateAuthUrl();
  ctx.sendSuccess(ws, frame.id, { url, state });
}

export async function handleAuthXCallback(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  if (!ctx.xOAuth2Handler) {
    ctx.sendError(
      ws,
      frame.id,
      "OAUTH_NOT_CONFIGURED",
      "X OAuth 2.0 not configured.",
    );
    return;
  }

  const { code, state } = frame.params as { code: string; state: string };

  try {
    const tokens = await ctx.xOAuth2Handler.handleCallback(code, state);

    // Fetch user info to get username
    let username: string | undefined;
    try {
      const userResponse = await fetch("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      if (userResponse.ok) {
        const userData = (await userResponse.json()) as {
          data: { username: string };
        };
        username = userData.data.username;
      }
    } catch {
      // Ignore user fetch error
    }

    ctx.credentialStore.setXCredentials(tokens, username);
    ctx.sendSuccess(ws, frame.id, { success: true, username });
  } catch (error) {
    ctx.sendError(
      ws,
      frame.id,
      "AUTH_CALLBACK_ERROR",
      ctx.getErrorMessage(error),
    );
  }
}

export function handleAuthXStatus(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const creds = ctx.credentialStore.getXCredentials();
  const authenticated = ctx.credentialStore.isXAuthenticated();
  const expired = ctx.credentialStore.isXTokenExpired();

  ctx.sendSuccess(ws, frame.id, {
    authenticated,
    expired,
    username: creds?.username,
    oauth2Configured: !!ctx.xOAuth2Handler,
    oauth1Configured: !!ctx.xConnector,
  });
}

export function handleAuthXLogout(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  ctx.credentialStore.clearXCredentials();
  ctx.sendSuccess(ws, frame.id, { success: true });
}

export function handleAuthDiscordStatus(
  ctx: AuthHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const status = {
    connected: ctx.isDiscordBotReady(),
    configured: !!ctx.discordBot,
    botName: ctx.discordBot?.getBotName() ?? null,
  };
  ctx.sendSuccess(ws, frame.id, status);
}
