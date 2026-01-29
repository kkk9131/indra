import { z } from "zod";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// Multimodal Content Block types
export const TextContentBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type TextContentBlock = z.infer<typeof TextContentBlockSchema>;

export const ImageContentBlockSchema = z.object({
  type: z.literal("image"),
  source: z.object({
    type: z.literal("base64"),
    media_type: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
    data: z.string(),
  }),
});
export type ImageContentBlock = z.infer<typeof ImageContentBlockSchema>;

export const ContentBlockSchema = z.union([
  TextContentBlockSchema,
  ImageContentBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

export const MultimodalMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});
export type MultimodalMessage = z.infer<typeof MultimodalMessageSchema>;

export const ChatOptionsSchema = z.object({
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
});
export type ChatOptions = z.infer<typeof ChatOptionsSchema>;

export interface LLMProvider {
  readonly id: "agent-sdk";
  readonly name: string;
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string>;
  chatStreamWithAgent?(
    messages: Message[] | MultimodalMessage[],
    options?: AgentChatOptions,
  ): AsyncIterable<AgentEvent>;
}

export interface LLMProviderConfig {
  model?: string; // "sonnet", "opus", "haiku"
  systemPrompt?: string;
}

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export interface AgentOptions {
  maxTurns?: number;
  tools?: string[];
  permissionMode?: PermissionMode;
}

export interface AgentChatOptions extends ChatOptions {
  agent?: AgentOptions;
  signal?: AbortSignal;
  hooks?: AgentHooks;
}

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; tool: string; input: unknown; toolUseId: string }
  | { type: "tool_result"; tool: string; result: string; toolUseId: string }
  | { type: "turn_complete"; turnNumber: number }
  | { type: "done"; result: string }
  | { type: "cancelled"; reason: string };

// Agent lifecycle hooks
export interface AgentHooks {
  onMessageStart?: (message: MultimodalMessage) => void | Promise<void>;
  onMessageEnd?: (
    message: MultimodalMessage,
    result: string,
  ) => void | Promise<void>;
  onToolStart?: (tool: string, input: unknown) => void | Promise<void>;
  onToolEnd?: (tool: string, result: string) => void | Promise<void>;
  onTurnComplete?: (turnNumber: number) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  onCancel?: (reason: string) => void | Promise<void>;
}
