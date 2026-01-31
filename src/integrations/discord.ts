import { Client, GatewayIntentBits, type TextChannel } from "discord.js";
import type { ConnectorStatus } from "./types.js";
import type { DiscordEmbed, SendResult } from "../channels/discord/types.js";
import { getErrorMessage } from "../channels/discord/types.js";

export interface DiscordConnectorConfig {
  token: string;
}

export class DiscordConnector {
  private client: Client | null = null;
  private status: ConnectorStatus = "disconnected";
  private config: DiscordConnectorConfig;

  constructor(config: DiscordConnectorConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.status = "connecting";

    try {
      this.client = new Client({
        intents: [GatewayIntentBits.Guilds],
      });
      await this.client.login(this.config.token);
      this.status = "connected";
    } catch (error) {
      this.status = "error";
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.status = "disconnected";
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  getClient(): Client | null {
    return this.client;
  }

  async sendMessage(channelId: string, content: string): Promise<SendResult> {
    return this.sendToChannel(channelId, async (channel) => {
      const message = await channel.send(content);
      return message.id;
    });
  }

  async sendEmbed(channelId: string, embed: DiscordEmbed): Promise<SendResult> {
    return this.sendToChannel(channelId, async (channel) => {
      const message = await channel.send({ embeds: [embed] });
      return message.id;
    });
  }

  private async sendToChannel(
    channelId: string,
    sendFn: (channel: TextChannel) => Promise<string>,
  ): Promise<SendResult> {
    if (!this.client) {
      return { success: false, error: "Not connected. Call connect() first." };
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return {
          success: false,
          error: `Channel ${channelId} not found or not a text channel`,
        };
      }

      const messageId = await sendFn(channel as TextChannel);
      return { success: true, messageId };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, "Failed to send message"),
      };
    }
  }
}
