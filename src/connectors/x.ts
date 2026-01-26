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
  private useOAuth2 = false;

  constructor(config: SNSConnectorConfig) {
    this.config = config;
  }

  /**
   * Update the OAuth2 access token (for dynamic token updates)
   */
  setOAuth2Token(accessToken: string): void {
    this.config.oauth2AccessToken = accessToken;
    // Reset client to use new token on next connect
    this.client = null;
    this.status = "disconnected";
  }

  async connect(): Promise<void> {
    this.status = "connecting";

    try {
      // Prefer OAuth 2.0 if available
      if (this.config.oauth2AccessToken) {
        this.client = new TwitterApi(this.config.oauth2AccessToken);
        this.useOAuth2 = true;
        this.status = "connected";
        return;
      }

      // Fall back to OAuth 1.0a
      if (!this.config.apiKey || !this.config.apiSecret) {
        throw new Error("X API credentials required: apiKey and apiSecret");
      }
      if (!this.config.accessToken || !this.config.accessSecret) {
        throw new Error(
          "X access credentials required: accessToken and accessSecret",
        );
      }

      this.client = new TwitterApi({
        appKey: this.config.apiKey,
        appSecret: this.config.apiSecret,
        accessToken: this.config.accessToken,
        accessSecret: this.config.accessSecret,
      });
      this.useOAuth2 = false;
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

  isUsingOAuth2(): boolean {
    return this.useOAuth2;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.status = "disconnected";
  }
}
