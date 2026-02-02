import type { Message } from "discord.js";
import type { GatewayServer } from "../gateway/server.js";
import type { TaskIntent } from "./types.js";

/**
 * メッセージベースのタスク実行ハンドラー
 * 特定チャンネルでのメッセージを監視し、タスク意図を解析して実行する
 */
export class MessageHandler {
  private taskChannelId: string | null;
  private gateway: GatewayServer | null = null;

  constructor() {
    this.taskChannelId = process.env.DISCORD_TASK_CHANNEL_ID ?? null;
    console.log(
      `[MessageHandler] Initialized: taskChannelId=${this.taskChannelId ?? "not set"}`,
    );
  }

  setGateway(gateway: GatewayServer): void {
    this.gateway = gateway;
  }

  /**
   * メッセージを処理すべきかどうかを判定
   */
  shouldProcess(message: Message): boolean {
    // タスクチャンネルが設定されていない場合はスキップ
    if (!this.taskChannelId) {
      return false;
    }

    // Botからのメッセージは無視
    if (message.author.bot) {
      return false;
    }

    // タスクチャンネル以外は無視
    if (message.channel.id !== this.taskChannelId) {
      return false;
    }

    // 空メッセージは無視
    if (!message.content.trim()) {
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
        // プロンプト部分を抽出
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
  async executeTask(intent: TaskIntent, message: Message): Promise<void> {
    if (!this.gateway) {
      await message.reply("⚠️ Gateway が初期化されていません");
      return;
    }

    // 実行中リアクション
    await message.react("⏳");

    try {
      switch (intent.type) {
        case "post": {
          const item = await this.gateway.createPostForDiscord(
            intent.platform ?? "x",
            intent.prompt,
          );

          // item.content は { text: string; mediaUrls?: string[] } 型
          const contentText =
            typeof item.content === "string" ? item.content : item.content.text;

          const embed = {
            title: "📝 投稿プレビュー",
            description: contentText,
            color: 0x3498db,
            fields: [
              { name: "Platform", value: item.platform, inline: true },
              { name: "ID", value: item.id, inline: true },
              { name: "Status", value: item.status, inline: true },
            ],
            footer: {
              text: "Web UIまたは /indra approve で承認してください",
            },
          };

          await message.reply({ embeds: [embed] });
          break;
        }

        case "chat": {
          const response = await this.gateway.chatForDiscord(intent.prompt);

          // Discord の文字数制限対応（2000文字）
          if (response.length > 2000) {
            const chunks = this.splitMessage(response, 2000);
            for (const chunk of chunks) {
              await message.reply(chunk);
            }
          } else {
            await message.reply(response);
          }
          break;
        }

        case "research": {
          await message.reply(
            `🔍 「${intent.prompt}」についてリサーチを開始します...`,
          );
          const result = await this.gateway.researchForDiscord(intent.prompt);
          if (result.success) {
            await message.reply(`✅ レポート完成: ${result.outputPath}`);
          } else {
            await message.reply(`❌ エラー: ${result.error}`);
          }
          break;
        }

        default:
          await message.reply(
            "⚠️ タスクの種類を判定できませんでした。もう少し具体的に指示してください。",
          );
      }

      // 完了リアクション
      await message.react("✅");
    } catch (error) {
      // エラーリアクション
      await message.react("❌");

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await message.reply(`❌ エラーが発生しました: ${errorMessage}`);
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

      // 改行で区切れる位置を探す
      let splitIndex = remaining.lastIndexOf("\n", maxLength);
      if (splitIndex === -1 || splitIndex < maxLength / 2) {
        // 改行がなければスペースで区切る
        splitIndex = remaining.lastIndexOf(" ", maxLength);
      }
      if (splitIndex === -1 || splitIndex < maxLength / 2) {
        // それでもなければ強制的に分割
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
