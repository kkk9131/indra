import { TwitterApi } from "twitter-api-v2";
import type {
  SNSConnector,
  SNSConnectorConfig,
  Content,
  PostResult,
  ConnectorStatus,
} from "./types.js";

export class XConnector implements SNSConnector {
  readonly platform = "x" as const;
  private client: TwitterApi | null = null;
  private status: ConnectorStatus = "disconnected";
  private config: SNSConnectorConfig;

  constructor(config: SNSConnectorConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error("X API credentials required: apiKey and apiSecret");
    }
    if (!this.config.accessToken || !this.config.accessSecret) {
      throw new Error(
        "X access credentials required: accessToken and accessSecret",
      );
    }

    this.status = "connecting";
    try {
      this.client = new TwitterApi({
        appKey: this.config.apiKey,
        appSecret: this.config.apiSecret,
        accessToken: this.config.accessToken,
        accessSecret: this.config.accessSecret,
      });
      this.status = "connected";
    } catch (error) {
      this.status = "error";
      throw error;
    }
  }

  async post(content: Content): Promise<PostResult> {
    if (!this.client) {
      return {
        success: false,
        error: "Not connected. Call connect() first.",
      };
    }

    try {
      const result = await this.client.v2.tweet(content.text);
      return {
        success: true,
        postId: result.data.id,
        url: `https://x.com/i/status/${result.data.id}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to post tweet",
      };
    }
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.status = "disconnected";
  }
}
