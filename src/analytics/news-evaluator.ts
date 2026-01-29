import dotenv from "dotenv";
import OpenAI from "openai";
import { join } from "node:path";
import { homedir } from "node:os";
import type { NewsArticle } from "../news/types.js";
import type { ApprovalItem } from "../approval/types.js";

// .env ファイルを ~/.claude/.env から読み込む
const envPath = join(homedir(), ".claude", ".env");
dotenv.config({ path: envPath });

/** 評価対象アイテム */
export interface EvaluationItem {
  id: string;
  title: string;
  summary: string;
  type: "news" | "post";
  sourceUrl?: string;
}

/** 評価結果 */
export interface EvaluationResult {
  id: string;
  score: number;
  importance: number;
  novelty: number;
  impact: number;
  reason: string;
}

/** ランキング結果 */
export interface RankedItem {
  rank: number;
  item: EvaluationItem;
  evaluation: EvaluationResult;
}

function getGLMClient(): OpenAI | null {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.z.ai/api/coding/paas/v4",
  });
}

function getEvaluationPrompt(items: EvaluationItem[]): string {
  const itemsJson = items.map((item, index) => ({
    index,
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary.substring(0, 500),
  }));

  return `以下のニュース/投稿を評価し、Top3をランキングしてください。

## 評価対象
${JSON.stringify(itemsJson, null, 2)}

## 評価基準
1. **重要度 (importance)**: AI/技術トレンドへの関連性、ビジネスインパクト（0-100）
2. **新規性 (novelty)**: 新しい情報かどうか、既知の情報との差分（0-100）
3. **影響度 (impact)**: ユーザーへの影響範囲、実用性（0-100）

## 出力形式
以下のJSON形式で回答してください:
{
  "rankings": [
    {
      "id": "元のアイテムID",
      "score": 総合スコア（importance * 0.4 + novelty * 0.3 + impact * 0.3）,
      "importance": 重要度スコア,
      "novelty": 新規性スコア,
      "impact": 影響度スコア,
      "reason": "ランキング理由（50-100文字の日本語）"
    }
  ]
}

注意:
- rankingsは総合スコアの高い順に並べてください
- 最大3件まで返してください
- 全項目が低品質の場合は空配列を返してください`;
}

interface GLMEvaluationResponse {
  rankings: Array<{
    id: string;
    score: number;
    importance: number;
    novelty: number;
    impact: number;
    reason: string;
  }>;
}

/**
 * ニュース・投稿を評価してTop3をランキングする
 */
export class NewsEvaluator {
  private client: OpenAI | null;
  private model: string;

  constructor(model = "glm-4.7") {
    this.client = getGLMClient();
    this.model = model;
  }

  /**
   * GLMが利用可能かどうか
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * NewsArticleをEvaluationItemに変換
   */
  newsToEvaluationItem(article: NewsArticle): EvaluationItem {
    return {
      id: article.id,
      title: article.title,
      summary: article.summary || article.body?.substring(0, 500) || "",
      type: "news",
      sourceUrl: article.url,
    };
  }

  /**
   * ApprovalItemをEvaluationItemに変換
   */
  postToEvaluationItem(item: ApprovalItem): EvaluationItem {
    return {
      id: item.id,
      title: `X投稿 (${new Date(item.createdAt).toLocaleString("ja-JP")})`,
      summary: item.content.text,
      type: "post",
      sourceUrl: item.postUrl,
    };
  }

  /**
   * アイテムを評価してTop3をランキング
   */
  async evaluate(items: EvaluationItem[]): Promise<RankedItem[]> {
    if (items.length === 0) {
      return [];
    }

    if (!this.client) {
      // GLMが利用できない場合はフォールバック（新しい順でソート）
      console.warn("NewsEvaluator: GLM not available, using fallback ranking");
      return items.slice(0, 3).map((item, index) => ({
        rank: index + 1,
        item,
        evaluation: {
          id: item.id,
          score: 50 - index * 10,
          importance: 50,
          novelty: 50,
          impact: 50,
          reason: "GLMが利用できないためデフォルトランキング",
        },
      }));
    }

    try {
      console.log(
        `NewsEvaluator: Evaluating ${items.length} items with GLM...`,
      );
      const start = Date.now();

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "あなたはAI/技術ニュースの評価エキスパートです。与えられたニュースや投稿を客観的に評価し、重要度・新規性・影響度に基づいてランキングしてください。",
          },
          {
            role: "user",
            content: getEvaluationPrompt(items),
          },
        ],
        response_format: { type: "json_object" },
      });

      const duration = Date.now() - start;
      console.log(`NewsEvaluator: GLM evaluation completed (${duration}ms)`);

      const content = completion.choices[0]?.message?.content ?? "{}";
      const response = JSON.parse(content) as GLMEvaluationResponse;

      // ランキング結果をマッピング
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const rankedItems: RankedItem[] = [];

      for (let i = 0; i < Math.min(response.rankings.length, 3); i++) {
        const ranking = response.rankings[i];
        const item = itemMap.get(ranking.id);

        if (item) {
          rankedItems.push({
            rank: i + 1,
            item,
            evaluation: {
              id: ranking.id,
              score: ranking.score,
              importance: ranking.importance,
              novelty: ranking.novelty,
              impact: ranking.impact,
              reason: ranking.reason,
            },
          });
        }
      }

      return rankedItems;
    } catch (error) {
      console.error("NewsEvaluator: GLM evaluation failed:", error);

      // フォールバック
      return items.slice(0, 3).map((item, index) => ({
        rank: index + 1,
        item,
        evaluation: {
          id: item.id,
          score: 50 - index * 10,
          importance: 50,
          novelty: 50,
          impact: 50,
          reason: "評価エラーのためデフォルトランキング",
        },
      }));
    }
  }

  /**
   * ランキング結果からサマリーを生成
   */
  async generateSummary(rankedItems: RankedItem[]): Promise<string> {
    if (rankedItems.length === 0) {
      return "評価対象のニュース/投稿がありませんでした。";
    }

    if (!this.client) {
      // フォールバック
      return rankedItems
        .map(
          (r) => `${r.rank}. ${r.item.title} (スコア: ${r.evaluation.score})`,
        )
        .join("\n");
    }

    try {
      const summaryPrompt = `以下のTop3ニュース/投稿について、100-200文字の日本語サマリーを生成してください。

${rankedItems
  .map(
    (r) => `${r.rank}位: ${r.item.title}
   評価理由: ${r.evaluation.reason}`,
  )
  .join("\n\n")}

サマリーには以下を含めてください:
- 今日の注目トピック
- 各ランキングの簡潔な説明`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "あなたはニュースサマリーを作成するエキスパートです。",
          },
          { role: "user", content: summaryPrompt },
        ],
      });

      return (
        completion.choices[0]?.message?.content ??
        "サマリーを生成できませんでした。"
      );
    } catch (error) {
      console.error("NewsEvaluator: Summary generation failed:", error);
      return rankedItems
        .map(
          (r) => `${r.rank}. ${r.item.title} (スコア: ${r.evaluation.score})`,
        )
        .join("\n");
    }
  }
}
