/**
 * X Post Workflow Service
 * Uses Claude Opus 4.5 via Agent SDK to generate optimized X posts
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { NewsArticle } from "../../content/news/types.js";
import { buildXPostSystemPrompt, buildRefinePrompt } from "./system-prompt.js";
import type {
  XPostWorkflowResult,
  XPostWorkflowOptions,
  XPostProgressEvent,
  GeneratedPost,
  PostEvaluation,
} from "./types.js";
import { LogCollector } from "../../../platform/logs/collector.js";
import type { OutcomeContent } from "../../../platform/logs/types.js";

interface WorkflowOutput {
  posts: Array<{
    id: string;
    text: string;
    charCount: number;
    templateUsed: string;
    evaluation: PostEvaluation;
  }>;
  bestPostId: string;
  summary: string;
}

function generatePostId(): string {
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractJsonFromText(text: string): WorkflowOutput | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as WorkflowOutput;
    } catch {
      // Continue to try other methods
    }
  }

  const objectMatch = text.match(/\{[\s\S]*"posts"[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as WorkflowOutput;
    } catch {
      // Failed to parse
    }
  }

  return null;
}

function createFallbackPost(text: string, articleTitle: string): GeneratedPost {
  const cleanText = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]*\}/g, "")
    .trim();

  const postText =
    cleanText.slice(0, 280) || `${articleTitle}についての最新情報をチェック！`;

  return {
    id: generatePostId(),
    text: postText,
    charCount: postText.length,
    score: 50,
    templateUsed: "breaking",
    evaluation: {
      overallScore: 50,
      replyPotential: 30,
      engagementPotential: 40,
      dwellTimePotential: 40,
      contentQuality: 50,
      feedback: "JSONパースに失敗したため、フォールバックポストを生成しました",
    },
  };
}

interface QueryMessage {
  type: string;
  subtype?: string;
  result?: string;
  message?: { content?: Array<{ text?: string }> };
}

function extractTextFromMessage(message: QueryMessage): string {
  if (
    message.type === "result" &&
    message.subtype === "success" &&
    message.result
  ) {
    return message.result;
  }
  if (message.type === "assistant" && message.message?.content) {
    return message.message.content.map((block) => block.text ?? "").join("");
  }
  return "";
}

function parseWorkflowOutputToPosts(output: WorkflowOutput): GeneratedPost[] {
  return output.posts.map((p) => ({
    id: p.id || generatePostId(),
    text: p.text,
    charCount: p.charCount || p.text.length,
    score: p.evaluation?.overallScore,
    templateUsed: p.templateUsed,
    evaluation: p.evaluation,
  }));
}

function findBestPost(
  posts: GeneratedPost[],
  bestPostId?: string,
): GeneratedPost {
  if (bestPostId) {
    const found = posts.find((p) => p.id === bestPostId);
    if (found) return found;
  }
  return posts.reduce((best, current) =>
    (current.score ?? 0) > (best.score ?? 0) ? current : best,
  );
}

export class XPostWorkflowService {
  private readonly defaultOptions: Required<XPostWorkflowOptions> = {
    targetScore: 70,
    maxRetries: 3,
  };

  async execute(
    article: NewsArticle,
    options: XPostWorkflowOptions = {},
    onProgress?: (event: XPostProgressEvent) => void,
  ): Promise<XPostWorkflowResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    const emitProgress = (
      stage: XPostProgressEvent["stage"],
      message: string,
      progress: number,
    ): void => {
      onProgress?.({ stage, message, progress });
    };

    try {
      emitProgress("started", "ワークフロー開始", 0);
      emitProgress("content_fetching", "記事内容を分析中...", 10);

      const systemPrompt = buildXPostSystemPrompt(article);

      emitProgress("template_selecting", "最適なテンプレートを選択中...", 20);
      emitProgress("composing", "投稿を生成中...", 30);

      const fullResponse = await this.queryLLM(
        "上記の記事情報を元に、Xアルゴリズムに最適化された投稿を3つ生成してください。",
        systemPrompt,
      );

      emitProgress("evaluating", "投稿を評価中...", 70);

      const output = extractJsonFromText(fullResponse);

      let posts: GeneratedPost[];
      let bestPost: GeneratedPost;

      if (output?.posts && output.posts.length > 0) {
        posts = parseWorkflowOutputToPosts(output);
        bestPost = findBestPost(posts, output.bestPostId);

        if (this.needsRefinement(bestPost, opts)) {
          emitProgress("refining", "投稿を改善中...", 85);
          const refinedPost = await this.refinePost(
            bestPost,
            opts.targetScore,
            opts.maxRetries,
          );
          if (refinedPost) {
            posts.push(refinedPost);
            if ((refinedPost.score ?? 0) > (bestPost.score ?? 0)) {
              bestPost = refinedPost;
            }
          }
        }
      } else {
        bestPost = createFallbackPost(fullResponse, article.title);
        posts = [bestPost];
      }

      emitProgress("completed", "生成完了", 100);

      const processingTime = Date.now() - startTime;

      // OutcomeLog (draft) 記録
      const outcomeId = crypto.randomUUID();
      const executionId = crypto.randomUUID(); // 簡易的に生成（将来的にはcontext経由で渡す）
      const outcomeContent: OutcomeContent = {
        posts: posts.map((p) => ({
          text: p.text,
          hashtags: [], // ハッシュタグ抽出は将来拡張
          score: p.score,
        })),
      };
      // logCollectorがない場合は新規作成（将来的にはDI）
      const collector = new LogCollector({ sessionId: article.id });
      collector.addOutcomeLog(
        outcomeId,
        executionId,
        "xpost",
        "draft",
        outcomeContent,
        undefined,
        { articleId: article.id, processingTime },
      );

      return {
        success: true,
        articleId: article.id,
        bestPost,
        allPosts: posts,
        processingTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      emitProgress("failed", `エラー: ${errorMessage}`, 0);

      return {
        success: false,
        articleId: article.id,
        error: errorMessage,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private needsRefinement(
    post: GeneratedPost,
    opts: Required<XPostWorkflowOptions>,
  ): boolean {
    return (
      post.score !== undefined &&
      post.score < opts.targetScore &&
      opts.maxRetries > 0
    );
  }

  private async queryLLM(
    prompt: string,
    systemPrompt: string,
  ): Promise<string> {
    let fullResponse = "";
    for await (const message of query({
      prompt,
      options: { model: "opus", maxTurns: 1, systemPrompt },
    })) {
      const text = extractTextFromMessage(message);
      if (message.type === "result") {
        fullResponse = text;
      } else {
        fullResponse += text;
      }
    }
    return fullResponse;
  }

  private async refinePost(
    post: GeneratedPost,
    targetScore: number,
    retriesLeft: number,
  ): Promise<GeneratedPost | null> {
    if (retriesLeft <= 0) return null;

    const feedback =
      post.evaluation?.feedback || "スコアが目標に達していません";
    const refinePrompt = buildRefinePrompt(
      post.text,
      post.score ?? 50,
      feedback,
    );

    try {
      const fullResponse = await this.queryLLM(
        refinePrompt,
        "あなたはX投稿の改善専門家です。指示に従って投稿を改善し、JSON形式で出力してください。",
      );

      const output = extractJsonFromText(fullResponse);
      if (!output?.posts?.length) return null;

      const refined = output.posts[0];
      const refinedPost: GeneratedPost = {
        id: generatePostId(),
        text: refined.text,
        charCount: refined.charCount || refined.text.length,
        score: refined.evaluation?.overallScore,
        templateUsed: refined.templateUsed,
        evaluation: refined.evaluation,
      };

      if (refinedPost.score !== undefined && refinedPost.score >= targetScore) {
        return refinedPost;
      }

      return this.refinePost(refinedPost, targetScore, retriesLeft - 1);
    } catch {
      return null;
    }
  }
}
