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
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  systemPrompt: z.string().optional(),
});
export type ChatOptions = z.infer<typeof ChatOptionsSchema>;

export const ProviderIdSchema = z.enum([
  "anthropic",
  "openai",
  "google",
  "ollama",
  "glm",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export interface LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string>;
}

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}
