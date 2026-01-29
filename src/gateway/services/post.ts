import type { Config, ConfigManager } from "../../config/index.js";
import {
  XConnector,
  type Content,
  type Platform,
} from "../../connectors/index.js";
import type { CredentialStore, XOAuth2Handler } from "../../auth/index.js";
import type { ApprovalItem } from "../../approval/types.js";
import type { ApprovalQueue, ApprovalStatus } from "../../approval/index.js";
import type { LLMProvider } from "../../llm/index.js";

export type PostApproveResult =
  | { ok: true; item: ApprovalItem }
  | { ok: false; code: string; message: string; item?: ApprovalItem | null };

export type PostScheduleResult =
  | { ok: true; item: ApprovalItem }
  | { ok: false; code: string; message: string };

export interface PostService {
  createDraft: (platform: Platform, prompt: string) => Promise<ApprovalItem>;
  addToQueue: (
    platform: Platform,
    content: Content,
    metadata?: Record<string, unknown>,
  ) => ApprovalItem;
  list: (status?: ApprovalStatus) => ApprovalItem[];
  approve: (id: string) => Promise<PostApproveResult>;
  reject: (id: string) => ApprovalItem | null;
  edit: (id: string, content: Content) => ApprovalItem | null;
  schedule: (id: string, scheduledAt: string) => PostScheduleResult;
}

interface PostServiceDeps {
  configManager: ConfigManager;
  approvalQueue: ApprovalQueue;
  credentialStore: CredentialStore;
  xConnector: XConnector | null;
  xOAuth2Handler: XOAuth2Handler | null;
  createLLMProvider: (config: Config["llm"]) => LLMProvider;
}

export function createPostService(deps: PostServiceDeps): PostService {
  return {
    addToQueue(platform, content, metadata) {
      return deps.approvalQueue.create({
        platform,
        content,
        metadata,
      });
    },
    async createDraft(platform, prompt) {
      const provider = deps.createLLMProvider(deps.configManager.get().llm);
      const systemPrompt = `You are a social media content creator. Generate a concise, engaging post for ${platform}.
Keep it under 280 characters. Be creative and natural. Output ONLY the post text, no explanations.`;

      const generatedText = await provider.chat(
        [{ role: "user", content: prompt }],
        { systemPrompt },
      );

      return deps.approvalQueue.create({
        platform,
        content: { text: generatedText.slice(0, 280) },
        prompt,
      });
    },
    list(status) {
      return deps.approvalQueue.list(status);
    },
    async approve(id) {
      const item = deps.approvalQueue.approve(id);
      if (!item) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: `Item not found: ${id}`,
        };
      }

      if (item.platform !== "x") {
        return {
          ok: false,
          code: "UNSUPPORTED_PLATFORM",
          message: `Platform not yet supported: ${item.platform}`,
        };
      }

      let xCreds = deps.credentialStore.getXCredentials();
      let connector: XConnector;

      // Try to refresh expired tokens
      if (xCreds && deps.credentialStore.isXTokenExpired()) {
        if (deps.xOAuth2Handler && xCreds.refreshToken) {
          try {
            const newTokens = await deps.xOAuth2Handler.refreshTokens(
              xCreds.refreshToken,
            );
            deps.credentialStore.setXCredentials(newTokens, xCreds.username);
            xCreds = deps.credentialStore.getXCredentials();
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            // Continue to fallback options
          }
        }
      }

      if (xCreds && !deps.credentialStore.isXTokenExpired()) {
        connector = new XConnector({ oauth2AccessToken: xCreds.accessToken });
      } else if (deps.xConnector) {
        connector = deps.xConnector;
      } else {
        const failedItem = deps.approvalQueue.markFailed(
          id,
          "X credentials not available or expired",
        );
        return {
          ok: false,
          code: "CONNECTOR_NOT_CONFIGURED",
          message:
            "X connector not configured. Authenticate via OAuth 2.0 or set OAuth 1.0a environment variables.",
          item: failedItem,
        };
      }

      try {
        await connector.connect();
        const result = await connector.post(item.content);

        if (result.success && result.postId && result.url) {
          const postedItem = deps.approvalQueue.markPosted(
            id,
            result.postId,
            result.url,
          );
          if (!postedItem) {
            return {
              ok: false,
              code: "MARK_POSTED_FAILED",
              message: "Failed to mark item as posted",
            };
          }
          return { ok: true, item: postedItem };
        }

        const failedItem = deps.approvalQueue.markFailed(
          id,
          result.error ?? "Unknown error",
        );
        return {
          ok: false,
          code: "POST_FAILED",
          message: result.error ?? "Failed to post",
          item: failedItem,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        const failedItem = deps.approvalQueue.markFailed(id, message);
        return { ok: false, code: "POST_ERROR", message, item: failedItem };
      }
    },
    reject(id) {
      return deps.approvalQueue.reject(id);
    },
    edit(id, content) {
      return deps.approvalQueue.update(id, { content });
    },
    schedule(id, scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return {
          ok: false,
          code: "INVALID_SCHEDULE_TIME",
          message: "Schedule time must be in the future",
        };
      }

      const item = deps.approvalQueue.schedule(id, scheduledAt);
      if (!item) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: `Item not found: ${id}`,
        };
      }

      return { ok: true, item };
    },
  };
}
