import { z } from "zod";
import { PlatformSchema, ContentSchema } from "../../integrations/types.js";

export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "posted",
  "scheduled",
  "failed",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalItemSchema = z.object({
  id: z.string(),
  platform: PlatformSchema,
  content: ContentSchema,
  status: ApprovalStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  prompt: z.string().optional(),
  postId: z.string().optional(),
  postUrl: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
});
export type ApprovalItem = z.infer<typeof ApprovalItemSchema>;

export const CreateApprovalItemSchema = z.object({
  platform: PlatformSchema,
  content: ContentSchema,
  prompt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateApprovalItem = z.infer<typeof CreateApprovalItemSchema>;
