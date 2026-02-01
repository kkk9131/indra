import { App } from "@slack/bolt";
import type { SlackBotConfig, NotificationData, SendResult } from "./types.js";
import { getErrorMessage } from "./types.js";
import { MessageHandler } from "./message-handler.js";
import type { GatewayServer } from "../gateway/server.js";
import type { ApprovalItem } from "../../platform/approval/types.js";

export class SlackBot {
  private app: App;
  private gateway?: GatewayServer;
  private messageHandler: MessageHandler;
  private ready = false;

  constructor(config: SlackBotConfig) {
    this.app = new App({
      token: config.botToken,
      appToken: config.appToken,
      socketMode: true,
      signingSecret: config.signingSecret,
    });
    this.messageHandler = new MessageHandler();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // メッセージ受信
    this.app.message(async ({ message, say }) => {
      const msg = message as {
        channel: string;
        subtype?: string;
        text?: string;
        bot_id?: string;
        user?: string;
      };

      console.log(
        `[Slack] Message received: channel=${msg.channel}, user=${msg.user ?? "unknown"}, text="${(msg.text ?? "").slice(0, 50)}"`,
      );

      if (!this.messageHandler.shouldProcess(msg)) {
        console.log(
          `[Slack] Message skipped: taskChannelId=${this.messageHandler.getTaskChannelId()}, bot_id=${msg.bot_id ?? "none"}`,
        );
        return;
      }

      console.log("[Slack] Processing message as task");
      const intent = this.messageHandler.parseTaskIntent(msg.text ?? "");
      console.log(`[Slack] Parsed intent: ${JSON.stringify(intent)}`);
      await this.messageHandler.executeTask(intent, say);
    });

    // 承認ボタン処理
    this.app.action("approve_post", async ({ body, ack, respond }) => {
      await ack();

      const actionBody = body as {
        actions: Array<{ value: string }>;
        user: { id: string };
        channel?: { id: string };
      };

      const itemId = actionBody.actions[0]?.value;
      const userId = actionBody.user.id;

      if (!itemId) {
        await respond("❌ 承認対象が見つかりません");
        return;
      }

      if (!this.gateway) {
        await respond("❌ Gateway が初期化されていません");
        return;
      }

      try {
        const result = await this.gateway.approvePostForDiscord(itemId);
        if (result.success) {
          await respond(`✅ <@${userId}> が投稿を承認しました (ID: ${itemId})`);
        } else {
          await respond(`❌ 承認に失敗しました: ${result.error}`);
        }
      } catch (error) {
        await respond(`❌ エラー: ${getErrorMessage(error, "Unknown error")}`);
      }
    });

    // 拒否ボタン処理
    this.app.action("reject_post", async ({ body, ack, respond }) => {
      await ack();

      const actionBody = body as {
        actions: Array<{ value: string }>;
        user: { id: string };
      };

      const itemId = actionBody.actions[0]?.value;
      const userId = actionBody.user.id;

      await respond(`🚫 <@${userId}> が投稿を拒否しました (ID: ${itemId})`);
      // 実際のreject処理はGateway経由で実装
    });

    // メンション対応
    this.app.event("app_mention", async ({ event, say }) => {
      const mentionEvent = event as {
        text: string;
        user: string;
        channel: string;
      };

      // メンション部分を除去してタスク意図を解析
      const textWithoutMention = mentionEvent.text
        .replace(/<@[A-Z0-9]+>/g, "")
        .trim();

      if (!textWithoutMention) {
        await say(
          `<@${mentionEvent.user}> こんにちは！何かお手伝いできることはありますか？`,
        );
        return;
      }

      const intent = this.messageHandler.parseTaskIntent(textWithoutMention);
      await this.messageHandler.executeTask(intent, say);
    });
  }

  setGateway(gateway: GatewayServer): void {
    this.gateway = gateway;
    this.messageHandler.setGateway(gateway);
  }

  /**
   * 通知を送信
   */
  async sendNotification(
    channelId: string,
    data: NotificationData,
  ): Promise<SendResult> {
    try {
      const blocks = this.buildNotificationBlocks(data);

      const result = await this.app.client.chat.postMessage({
        channel: channelId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blocks: blocks as any,
        text: `${data.title}: ${data.description}`,
      });

      return {
        success: true,
        messageId: result.ts,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(
        error,
        "Failed to send notification",
      );
      console.error("Slack sendNotification error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 承認リクエストを送信
   */
  async sendApprovalRequest(
    channelId: string,
    item: ApprovalItem,
  ): Promise<SendResult> {
    try {
      const contentText =
        typeof item.content === "string" ? item.content : item.content.text;

      const result = await this.app.client.chat.postMessage({
        channel: channelId,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📋 投稿承認リクエスト",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: contentText,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `*Platform:* ${item.platform} | *ID:* \`${item.id}\``,
              },
            ],
          },
          {
            type: "divider",
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "✅ 承認",
                  emoji: true,
                },
                style: "primary",
                action_id: "approve_post",
                value: item.id,
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "❌ 拒否",
                  emoji: true,
                },
                style: "danger",
                action_id: "reject_post",
                value: item.id,
              },
            ],
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        text: `投稿承認リクエスト: ${contentText.slice(0, 100)}...`,
      });

      return {
        success: true,
        messageId: result.ts,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(
        error,
        "Failed to send approval request",
      );
      console.error("Slack sendApprovalRequest error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 通知用Block Kitを構築
   */
  private buildNotificationBlocks(data: NotificationData): unknown[] {
    const emoji =
      data.type === "approval_pending"
        ? "📋"
        : data.type === "task_executed"
          ? "✅"
          : "⚠️";

    const blocks: unknown[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${data.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: data.description,
        },
      },
    ];

    // コンテンツがある場合
    if (data.content) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\`\`\`${data.content.slice(0, 2900)}\`\`\``,
        },
      });
    }

    // エラーがある場合
    if (data.error) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error:* ${data.error}`,
        },
      });
    }

    // 承認待ちの場合はボタンを追加
    if (data.type === "approval_pending" && data.itemId) {
      blocks.push(
        {
          type: "divider",
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "✅ 承認",
                emoji: true,
              },
              style: "primary",
              action_id: "approve_post",
              value: data.itemId,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "❌ 拒否",
                emoji: true,
              },
              style: "danger",
              action_id: "reject_post",
              value: data.itemId,
            },
          ],
        },
      );
    }

    return blocks;
  }

  async start(): Promise<void> {
    await this.app.start();
    this.ready = true;
    console.log("Slack bot started (Socket Mode)");
  }

  async stop(): Promise<void> {
    await this.app.stop();
    this.ready = false;
    console.log("Slack bot stopped");
  }

  isReady(): boolean {
    return this.ready;
  }

  getBotName(): string | null {
    // Bolt APIではbot情報を直接取得するのが難しいため、nullを返す
    return null;
  }
}
