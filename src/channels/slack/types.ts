import { z } from "zod";

// Configuration schema for config file
export const SlackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  taskChannelId: z.string().optional(),
  notificationChannelId: z.string().optional(),
  approvalChannelId: z.string().optional(),
});
export type SlackConfig = z.infer<typeof SlackConfigSchema>;

// Notification types for Slack
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

// Task intent for message-based task execution
export interface TaskIntent {
  type: "post" | "chat" | "research" | "unknown";
  platform?: "x" | "discord" | "note";
  prompt: string;
  raw: string;
}

// Bot initialization config
export interface SlackBotConfig {
  botToken: string;
  appToken: string;
  signingSecret?: string;
}

// Slack action from interactive components
export interface SlackAction {
  action: "approve" | "reject";
  itemId: string;
  userId: string;
}

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
