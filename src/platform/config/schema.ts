import { z } from "zod";

export const LLMConfigSchema = z.object({
  model: z.string().default("sonnet"),
  systemPrompt: z.string().optional(),
});
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export const GeneralConfigSchema = z.object({
  language: z.enum(["en", "ja", "zh"]).default("en"),
  theme: z.enum(["light", "dark", "auto"]).default("auto"),
  notifications: z.boolean().default(true),
  autoSave: z.boolean().default(true),
});
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>;

export const DiscordConfigSchema = z.object({
  enabled: z.boolean().default(false),
  reportChannelId: z.string().optional(),
  generalChannelId: z.string().optional(),
  taskChannelId: z.string().optional(),
  guildIds: z.array(z.string()).optional(),
});
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

export const ConfigSchema = z.object({
  general: GeneralConfigSchema.default({}),
  llm: LLMConfigSchema.default({}),
  discord: DiscordConfigSchema.default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

export function createDefaultConfig(): Config {
  return ConfigSchema.parse({});
}
