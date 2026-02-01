import type { SayFn } from "@slack/bolt";
import type { GatewayServer } from "../gateway/server.js";
import type { TaskIntent } from "./types.js";

/**
 * メッセージベースのタスク実行ハンドラー
 * Slack特定チャンネルでのメッセージを監視し、タスク意図を解析して実行する
 */
export class MessageHandler {
  private taskChannelId: string | null;
  private gateway: GatewayServer | null = null;

  constructor() {
    this.taskChannelId = process.env.SLACK_TASK_CHANNEL_ID ?? null;
    console.log(
      `[Slack MessageHandler] Initialized: taskChannelId=${this.taskChannelId ?? "not set"}`,
    );
  }

  setGateway(gateway: GatewayServer): void {
    this.gateway = gateway;
  }

  /**
   * メッセージを処理すべきかどうかを判定
   */
  shouldProcess(message: {
    channel: string;
    subtype?: string;
    text?: string;
    bot_id?: string;
  }): boolean {
    // タスクチャンネルが設定されていない場合はスキップ
    if (!this.taskChannelId) {
      return false;
    }

    // Botからのメッセージは無視
    if (message.bot_id || message.subtype === "bot_message") {
      return false;
    }

    // タスクチャンネル以外は無視
    if (message.channel !== this.taskChannelId) {
      return false;
    }

    // 空メッセージは無視
    if (!message.text?.trim()) {
      return false;
    }

    return true;
  }

  /**
   * メッセージからタスク意図を解析
   */
  parseTaskIntent(content: string): TaskIntent {
    const normalizedContent = content.toLowerCase().trim();
    const raw = content.trim();

    // X投稿作成パターン
    const postPatterns = [
      /^(?:x|twitter)?(?:に)?(?:投稿|ポスト)(?:を)?(?:作成|生成|作って|して)/,
      /^(?:x|twitter)\s*post/i,
      /^create\s+(?:x|twitter)\s+post/i,
      /投稿(?:を)?(?:作成|生成|作って)/,
    ];

    for (const pattern of postPatterns) {
      if (pattern.test(normalizedContent)) {
        // プロンプト部分を抽出
        const prompt = content
          .replace(
            /^(?:x|twitter)?(?:に)?(?:投稿|ポスト)(?:を)?(?:作成|生成|作って|して)[：:、\s]*/i,
            "",
          )
          .replace(/^(?:x|twitter)\s*post[：:、\s]*/i, "")
          .replace(/^create\s+(?:x|twitter)\s+post[：:、\s]*/i, "")
          .trim();

        return {
          type: "post",
          platform: "x",
          prompt: prompt || "最新のAI関連ニュースについて",
          raw,
        };
      }
    }

    // リサーチパターン
    const researchPatterns = [
      /(?:について)?(?:調べて|リサーチして|調査して|検索して)/,
      /(?:の)?(?:リサーチ|調査|レポート)(?:を)?(?:作成|生成|お願い)/,
      /(?:市場調査|トレンド調査|比較調査)(?:を)?(?:して|お願い)/,
    ];

    for (const pattern of researchPatterns) {
      if (pattern.test(normalizedContent)) {
        const prompt = content
          .replace(
            /(?:について)?(?:調べて|リサーチして|調査して|検索して)/gi,
            "",
          )
          .replace(
            /(?:の)?(?:リサーチ|調査|レポート)(?:を)?(?:作成|生成|お願い)/gi,
            "",
          )
          .replace(
            /(?:市場調査|トレンド調査|比較調査)(?:を)?(?:して|お願い)/gi,
            "",
          )
          .trim();

        return {
          type: "research",
          prompt: prompt || raw,
          raw,
        };
      }
    }

    // チャットパターン
    const chatPatterns = [
      /(?:について)?(?:教えて|説明して)/,
      /^(?:質問|聞きたい)/,
      /\?$/,
    ];

    for (const pattern of chatPatterns) {
      if (pattern.test(normalizedContent)) {
        return {
          type: "chat",
          prompt: raw,
          raw,
        };
      }
    }

    // デフォルトはチャットとして扱う
    return {
      type: "chat",
      prompt: raw,
      raw,
    };
  }

  /**
   * タスクを実行
   */
  async executeTask(intent: TaskIntent, say: SayFn): Promise<void> {
    if (!this.gateway) {
      await say("⚠️ Gateway が初期化されていません");
      return;
    }

    // 実行中リアクション（Slackではsay経由で通知）
    await say("⏳ 処理中...");

    try {
      switch (intent.type) {
        case "post": {
          const item = await this.gateway.createPostForDiscord(
            intent.platform ?? "x",
            intent.prompt,
          );

          const contentText =
            typeof item.content === "string" ? item.content : item.content.text;

          // Block Kit形式で返信
          await say({
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "📝 投稿プレビュー",
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
                    text: `*Platform:* ${item.platform} | *ID:* ${item.id} | *Status:* ${item.status}`,
                  },
                ],
              },
              {
                type: "divider",
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "Web UIまたは承認ボタンで承認してください",
                },
              },
            ],
          });
          break;
        }

        case "chat": {
          const response = await this.gateway.chatForDiscord(intent.prompt);

          // Slack の文字数制限対応（4000文字）
          if (response.length > 4000) {
            const chunks = this.splitMessage(response, 4000);
            for (const chunk of chunks) {
              await say(chunk);
            }
          } else {
            await say(response);
          }
          break;
        }

        case "research": {
          await say(`🔍 「${intent.prompt}」についてリサーチを開始します...`);
          break;
        }

        default:
          await say(
            "⚠️ タスクの種類を判定できませんでした。もう少し具体的に指示してください。",
          );
      }

      await say("✅ 完了");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await say(`❌ エラーが発生しました: ${errorMessage}`);
    }
  }

  /**
   * メッセージを指定文字数で分割
   */
  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      let splitIndex = remaining.lastIndexOf("\n", maxLength);
      if (splitIndex === -1 || splitIndex < maxLength / 2) {
        splitIndex = remaining.lastIndexOf(" ", maxLength);
      }
      if (splitIndex === -1 || splitIndex < maxLength / 2) {
        splitIndex = maxLength;
      }

      chunks.push(remaining.slice(0, splitIndex));
      remaining = remaining.slice(splitIndex).trim();
    }

    return chunks;
  }

  /**
   * タスクチャンネルが設定されているかどうか
   */
  isEnabled(): boolean {
    return this.taskChannelId !== null;
  }

  /**
   * タスクチャンネルIDを取得
   */
  getTaskChannelId(): string | null {
    return this.taskChannelId;
  }
}
