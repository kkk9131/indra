import { z } from "zod";

export const PlatformSchema = z.enum(["x", "note", "discord"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const ConnectorStatusSchema = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "error",
]);
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;

export const ContentSchema = z.object({
  text: z.string().max(25000), // X premium: 25000, note: longer
  mediaUrls: z.array(z.string()).optional(),
});
export type Content = z.infer<typeof ContentSchema>;

export const PostResultSchema = z.object({
  success: z.boolean(),
  postId: z.string().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
});
export type PostResult = z.infer<typeof PostResultSchema>;

export interface SNSConnector {
  readonly platform: Platform;
  connect(): Promise<void>;
  post(content: Content): Promise<PostResult>;
  getStatus(): ConnectorStatus;
  disconnect(): Promise<void>;
}

export interface SNSConnectorConfig {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessSecret?: string;
  // OAuth 2.0 PKCE token (takes priority over OAuth 1.0a)
  oauth2AccessToken?: string;
}
