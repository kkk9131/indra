import { z } from "zod";
import { ProviderIdSchema } from "../llm/types.js";

export const LLMConfigSchema = z.object({
  provider: ProviderIdSchema.default("anthropic"),
  apiKey: z.string().optional(),
  model: z.string().default("claude-sonnet-4-20250514"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(2048),
  systemPrompt: z.string().optional(),
  baseUrl: z.string().optional(),
});
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export const GeneralConfigSchema = z.object({
  language: z.enum(["en", "ja", "zh"]).default("en"),
  theme: z.enum(["light", "dark", "auto"]).default("auto"),
  notifications: z.boolean().default(true),
  autoSave: z.boolean().default(true),
});
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>;

export const ConfigSchema = z.object({
  general: GeneralConfigSchema.default({}),
  llm: LLMConfigSchema.default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

export function createDefaultConfig(): Config {
  return ConfigSchema.parse({});
}
