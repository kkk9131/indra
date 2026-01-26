import { z } from "zod";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

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
    messages: Message[],
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
}

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; tool: string; input: unknown; toolUseId: string }
  | { type: "tool_result"; tool: string; result: string; toolUseId: string }
  | { type: "turn_complete"; turnNumber: number }
  | { type: "done"; result: string };
