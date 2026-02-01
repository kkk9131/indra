import { z } from "zod";

/**
 * Post Template Types
 */
export const PostTemplateSchema = z.enum([
  "question",
  "breaking",
  "learning",
  "tip",
  "achievement",
]);
export type PostTemplate = z.infer<typeof PostTemplateSchema>;

/**
 * Time Slot for scheduling
 */
export const TimeSlotSchema = z.enum(["morning", "afternoon", "evening"]);
export type TimeSlot = z.infer<typeof TimeSlotSchema>;

/**
 * Time slot configuration
 */
export const TIME_SLOT_CONFIG: Record<
  TimeSlot,
  { label: string; defaultHour: number }
> = {
  morning: { label: "午前", defaultHour: 8 },
  afternoon: { label: "午後", defaultHour: 13 },
  evening: { label: "夜", defaultHour: 20 },
};

/**
 * Allowed emojis for X posts
 */
export const ALLOWED_EMOJIS = [
  "🔥",
  "🚀",
  "✅",
  "☝️",
  "👇",
  "👉",
  "👈",
] as const;
export type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number];

/**
 * Post structure options
 */
export const PostStructureOptionsSchema = z.object({
  includeQuestion: z.boolean().default(true),
  includeEmoji: z.boolean().default(true),
  maxHashtags: z.number().min(0).max(2).default(2),
  targetCharCount: z.number().min(100).max(600).default(450),
});
export type PostStructureOptions = z.infer<typeof PostStructureOptionsSchema>;
