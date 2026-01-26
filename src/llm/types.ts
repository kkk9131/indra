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
}

export interface LLMProviderConfig {
  model?: string; // "sonnet", "opus", "haiku"
  systemPrompt?: string;
}
