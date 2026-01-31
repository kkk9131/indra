import { z } from "zod";
import type { ChatInputCommandInteraction, APIEmbed } from "discord.js";
import type { GatewayServer } from "../gateway/server.js";

// Configuration schema for config file
export const DiscordConfigSchema = z.object({
  enabled: z.boolean().default(false),
  reportChannelId: z.string().optional(),
  generalChannelId: z.string().optional(),
  taskChannelId: z.string().optional(),
  guildIds: z.array(z.string()).optional(),
});
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

// Notification types for Discord
export type NotificationType = "approval_pending" | "task_executed" | "error";

export interface NotificationData {
  type: NotificationType;
  title: string;
  description: string;
  itemId?: string;
  platform?: string;
  content?: string;
  error?: string;
}

// Task intent for message-based task execution (Phase 3)
export interface TaskIntent {
  type: "post" | "chat" | "unknown";
  platform?: "x" | "discord";
  prompt: string;
  raw: string;
}

// Bot initialization config
export interface DiscordBotConfig {
  token: string;
  clientId: string;
  guildIds?: string[];
}

// Command execution context
export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  gateway: GatewayServer;
}

// Slash command definition
export interface SlashCommand {
  name: string;
  description: string;
  options?: SlashCommandOption[];
  execute(ctx: CommandContext): Promise<void>;
}

export interface SlashCommandOption {
  name: string;
  description: string;
  type: "string" | "integer" | "boolean" | "user" | "channel";
  required?: boolean;
  choices?: Array<{ name: string; value: string }>;
}

// Re-export discord.js embed type for convenience
export type DiscordEmbed = APIEmbed;

// Result type for message sending operations
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Helper to extract error message
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
