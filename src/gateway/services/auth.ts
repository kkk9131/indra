import type { CredentialStore, XOAuth2Handler } from "../../auth/index.js";
import type { XConnector } from "../../connectors/index.js";
import type { DiscordBot } from "../../discord/index.js";

export type AuthStartResult =
  | { ok: true; url: string; state: string }
  | { ok: false; code: string; message: string };

export type AuthCallbackResult =
  | { ok: true; username?: string }
  | { ok: false; code: string; message: string };

export interface AuthService {
  startXAuth: () => AuthStartResult;
  handleXCallback: (code: string, state: string) => Promise<AuthCallbackResult>;
  getXStatus: () => {
    authenticated: boolean;
    expired: boolean;
    username?: string;
    oauth2Configured: boolean;
    oauth1Configured: boolean;
  };
  logoutX: () => void;
  getDiscordStatus: () => {
    connected: boolean;
    configured: boolean;
    botName: string | null;
  };
}

interface AuthServiceDeps {
  credentialStore: CredentialStore;
  xOAuth2Handler: XOAuth2Handler | null;
  xConnector: XConnector | null;
  discordBot: DiscordBot | null;
  isDiscordBotReady: () => boolean;
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  return {
    startXAuth() {
      if (!deps.xOAuth2Handler) {
        return {
          ok: false,
          code: "OAUTH_NOT_CONFIGURED",
          message:
            "X OAuth 2.0 not configured. Set X_CLIENT_ID environment variable.",
        };
      }

      const { url, state } = deps.xOAuth2Handler.generateAuthUrl();
      return { ok: true, url, state };
    },
    async handleXCallback(code, state) {
      if (!deps.xOAuth2Handler) {
        return {
          ok: false,
          code: "OAUTH_NOT_CONFIGURED",
          message: "X OAuth 2.0 not configured.",
        };
      }

      try {
        const tokens = await deps.xOAuth2Handler.handleCallback(code, state);

        let username: string | undefined;
        try {
          const userResponse = await fetch(
            "https://api.twitter.com/2/users/me",
            {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            },
          );
          if (userResponse.ok) {
            const userData = (await userResponse.json()) as {
              data: { username: string };
            };
            username = userData.data.username;
          }
        } catch {
          // Ignore user fetch error
        }

        deps.credentialStore.setXCredentials(tokens, username);
        return { ok: true, username };
      } catch (error) {
        return {
          ok: false,
          code: "AUTH_CALLBACK_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    getXStatus() {
      const creds = deps.credentialStore.getXCredentials();
      const authenticated = deps.credentialStore.isXAuthenticated();
      const expired = deps.credentialStore.isXTokenExpired();

      return {
        authenticated,
        expired,
        username: creds?.username,
        oauth2Configured: !!deps.xOAuth2Handler,
        oauth1Configured: !!deps.xConnector,
      };
    },
    logoutX() {
      deps.credentialStore.clearXCredentials();
    },
    getDiscordStatus() {
      return {
        connected: deps.isDiscordBotReady(),
        configured: !!deps.discordBot,
        botName: deps.discordBot?.getBotName() ?? null,
      };
    },
  };
}
