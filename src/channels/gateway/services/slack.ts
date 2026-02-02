import type { ApprovalItem } from "../../../platform/approval/types.js";
import type { Platform } from "../../../integrations/index.js";
import type { AuthService } from "./auth.js";
import type { ChatService } from "./chat.js";
import type { PostService } from "./post.js";

export interface SlackIntegrationService {
  chat: (prompt: string) => Promise<string>;
  createPost: (platform: Platform, prompt: string) => Promise<ApprovalItem>;
  approvePost: (id: string) => Promise<{
    success: boolean;
    item?: ApprovalItem | null;
    error?: string;
  }>;
  getStatus: () => {
    gateway: string;
    xAuth: string;
    slackBot: string;
    pendingPosts: number;
  };
}

interface SlackIntegrationServiceDeps {
  chat: ChatService;
  post: PostService;
  auth: AuthService;
  isSlackBotReady: () => boolean;
  broadcast: (event: string, payload: unknown) => void;
}

export function createSlackIntegrationService(
  deps: SlackIntegrationServiceDeps,
): SlackIntegrationService {
  return {
    async chat(prompt) {
      const config = deps.chat.getConfig();
      const provider = deps.chat.createProvider();

      const response = await provider.chat(
        [{ role: "user", content: prompt }],
        {
          systemPrompt: config.llm.systemPrompt,
        },
      );

      return response;
    },
    async createPost(platform, prompt) {
      const item = await deps.post.createDraft(platform, prompt);
      deps.broadcast("post.created", { item });
      return item;
    },
    async approvePost(id) {
      const result = await deps.post.approve(id);

      if (result.ok) {
        deps.broadcast("post.updated", { item: result.item });
        return { success: true, item: result.item };
      }

      if (result.item) {
        deps.broadcast("post.updated", { item: result.item });
      }

      return {
        success: false,
        item: result.item ?? null,
        error: result.message,
      };
    },
    getStatus() {
      const authStatus = deps.auth.getXStatus();
      const xAuth = authStatus.authenticated
        ? authStatus.expired
          ? "Expired"
          : `Connected (@${authStatus.username ?? "unknown"})`
        : "Not connected";

      const slackConnected = deps.isSlackBotReady();

      return {
        gateway: "Running",
        xAuth,
        slackBot: slackConnected ? "Connected" : "Not connected",
        pendingPosts: deps.post.list("pending").length,
      };
    },
  };
}
