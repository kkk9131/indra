import { z } from "zod";

export const SlackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  taskChannelId: z.string().optional(),
  notificationChannelId: z.string().optional(),
  approvalChannelId: z.string().optional(),
});

export type SlackConfig = z.infer<typeof SlackConfigSchema>;

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

export interface TaskIntent {
  type: "post" | "chat" | "research" | "unknown";
  platform?: "x" | "discord" | "note";
  prompt: string;
  raw: string;
}

export interface SlackBotConfig {
  botToken: string;
  appToken: string;
  signingSecret?: string;
}

export interface SlackAction {
  action: "approve" | "reject";
  itemId: string;
  userId: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
