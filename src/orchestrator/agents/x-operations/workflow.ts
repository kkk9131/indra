import { promises as fs } from "fs";
import { join } from "path";
import type { RunRegistry } from "../subagent/index.js";
import { BaseWorkflow } from "../subagent/base-workflow.js";
import type { XPostCheckpoint, GeneratedPost } from "./types.js";
import { IdempotencyManager } from "./idempotency.js";
import { createXOperationsAgents } from "./agents.js";

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  content: string;
  summary?: string;
  publishedAt?: Date;
}

export interface XPostResult {
  success: boolean;
  runId: string;
  allPosts?: GeneratedPost[];
  bestPost?: GeneratedPost;
  error?: string;
}

export class XOperationsWorkflow extends BaseWorkflow<
  NewsArticle,
  XPostResult,
  XPostCheckpoint
> {
  private idempotency: IdempotencyManager;
  private static readonly MAX_RAW_RESULT_CHARS = 4000;

  constructor(registry: RunRegistry, idempotency: IdempotencyManager) {
    super(registry);
    this.idempotency = idempotency;
  }

  protected get agentName(): string {
    return "x-operations-agent";
  }

  protected initCheckpoint(article: NewsArticle): XPostCheckpoint {
    return {
      articleId: article.id,
      phase: "analyzing",
      refinementCount: 0,
    };
  }

  /**
   * Idempotency付きの投稿作成（public API）
   *
   * BaseWorkflow.execute() をラップして冪等性を保証する。
   */
  async createPost(article: NewsArticle): Promise<XPostResult> {
    console.log(`[${this.agentName}] Starting createPost for: ${article.id}`);

    const idempotencyKey = this.idempotency.generateKey(
      article.id,
      "create-post",
    );
    const idempotencyCheck = this.idempotency.checkAndSet(idempotencyKey);

    if (idempotencyCheck.alreadyExecuted) {
      console.log(`[${this.agentName}] Already executed: ${article.id}`);
      return idempotencyCheck.result as XPostResult;
    }

    try {
      const result = await this.execute(article);
      this.idempotency.recordSuccess(idempotencyKey, result);
      return result;
    } catch (error) {
      this.idempotency.clearOnFailure(idempotencyKey);
      throw error;
    }
  }

  /**
   * ドメイン固有のワークフロー実行
   *
   * BaseWorkflow.execute() から呼ばれる。
   * レジストリ管理（start/complete/fail）は基底クラスが担当。
   */
  protected async run(
    runId: string,
    article: NewsArticle,
  ): Promise<XPostResult> {
    await this.clearTempFiles();

    const agents = await createXOperationsAgents();
    const agentDef = agents["x-operations-agent"];

    await this.updatePhase(runId, "generating");

    const prompt = this.buildPrompt(article);

    console.log(
      `[${this.agentName}] Agent tools: ${agentDef.tools?.join(", ") ?? "none"}`,
    );

    const { finalResult, toolResults } = await this.runAgent(
      runId,
      prompt,
      agentDef,
      {
        maxTurns: 15,
        onEvent: async (event) => {
          if (event.type === "tool_start" && event.tool === "Skill") {
            const skillArg = String(event.input ?? "");
            if (skillArg.includes("evaluate")) {
              await this.updatePhase(runId, "evaluating");
            } else if (skillArg.includes("refine")) {
              await this.updatePhase(runId, "refining");
            }
          }
        },
      },
    );

    return this.processResult(runId, article, finalResult, toolResults);
  }

  private buildPrompt(article: NewsArticle): string {
    return `以下の記事からX投稿を作成してください。

## ワークフロー
1. glm-generate スキルを使って5つの投稿候補を生成
2. x-algorithm-evaluate スキルで評価し上位3つを選定
3. x-post-refine スキルで改善

## 記事情報
タイトル: ${article.title}
URL: ${article.url}
${article.summary ? `要約: ${article.summary}` : ""}

本文:
${article.content.slice(0, 2000)}${article.content.length > 2000 ? "..." : ""}

## glm-generate用プロンプト
以下の内容でglm-generateスキルを呼び出してください:

記事「${article.title}」から5つのX投稿候補を生成。
各投稿は280文字以内、日本語、エンゲージメント重視。

## 最終出力形式（必須）
全ての処理が完了したら、最後のメッセージは必ず以下のJSON形式のみを出力してください。
説明文やMarkdownは不要です。JSONブロックだけを返してください。

\`\`\`json
{
  "posts": [
    { "id": "post_1", "text": "投稿内容", "score": 85 },
    { "id": "post_2", "text": "投稿内容", "score": 80 },
    { "id": "post_3", "text": "投稿内容", "score": 75 }
  ],
  "bestPostId": "post_1"
}
\`\`\``;
  }

  private async processResult(
    runId: string,
    article: NewsArticle,
    finalResult: string,
    toolResults: string[],
  ): Promise<XPostResult> {
    // finalResult → toolResults → tempファイルの順でパースを試みる
    let parsed = this.parseWorkflowResult(finalResult);
    if (!parsed || parsed.posts.length === 0) {
      for (let i = toolResults.length - 1; i >= 0; i--) {
        parsed = this.parseWorkflowResult(toolResults[i]);
        if (parsed && parsed.posts.length > 0) {
          console.log(
            `[${this.agentName}] Parsed posts from toolResults[${i}]`,
          );
          break;
        }
      }
    }
    // tempファイルからの回収（スキルが書き出したfinal-result.json）
    if (!parsed || parsed.posts.length === 0) {
      parsed = await this.tryReadTempResult();
    }

    if (!parsed || parsed.posts.length === 0) {
      console.log(`[${this.agentName}] Failed to parse result, using fallback`);
      const maxChars = XOperationsWorkflow.MAX_RAW_RESULT_CHARS;
      const truncatedResult =
        finalResult.length > maxChars
          ? `${finalResult.slice(0, maxChars)}...`
          : finalResult;
      const fallbackPost: GeneratedPost = {
        id: `post_${Date.now()}_1`,
        text: `【${article.title}】\n\n要点をまとめました\n\n詳細はリプライで`,
        score: 60,
      };

      await this.registry.updateCheckpoint(runId, {
        phase: "pending_approval",
        parseError: "Failed to parse workflow result",
        rawResult: truncatedResult,
        generatedPosts: [fallbackPost],
        bestPostId: fallbackPost.id,
      });

      return {
        success: true,
        runId,
        allPosts: [fallbackPost],
        bestPost: fallbackPost,
      };
    }

    const generatedPosts = parsed.posts;
    const bestPost =
      generatedPosts.find((p) => p.id === parsed.bestPostId) ??
      generatedPosts[0];

    await this.registry.updateCheckpoint(runId, {
      phase: "pending_approval",
      generatedPosts,
      bestPostId: bestPost.id,
    });

    return {
      success: true,
      runId,
      allPosts: generatedPosts,
      bestPost,
    };
  }

  // --- ドメイン固有: 結果パース ---

  private parseWorkflowResult(result: string): {
    posts: GeneratedPost[];
    bestPostId: string;
  } | null {
    const jsonText = this.extractJsonFromResult(result);
    if (!jsonText) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return null;
    }

    const payload = parsed as Record<string, unknown>;
    let rawPosts: unknown[] | null = null;
    if (Array.isArray(payload.posts)) {
      rawPosts = payload.posts;
    } else if (Array.isArray(payload.candidates)) {
      rawPosts = payload.candidates;
    }
    if (!rawPosts) return null;

    const posts = rawPosts
      .map((item, index) => this.normalizePost(item, index))
      .filter((post): post is GeneratedPost => post !== null);

    if (posts.length === 0) return null;

    const bestPostPayload = payload as {
      bestPostId?: string;
      bestPost?: { id?: string };
    };
    const bestPostId =
      bestPostPayload.bestPostId ?? bestPostPayload.bestPost?.id ?? posts[0].id;

    return { posts, bestPostId };
  }

  private normalizePost(input: unknown, index: number): GeneratedPost | null {
    if (!input || typeof input !== "object") return null;

    const item = input as {
      id?: string;
      text?: string;
      content?: string;
      score?: number;
      evaluation?: { overallScore?: number };
    };

    let text = "";
    if (typeof item.text === "string") {
      text = item.text;
    } else if (typeof item.content === "string") {
      text = item.content;
    }
    if (!text.trim()) return null;

    let score: number | undefined;
    if (typeof item.score === "number") {
      score = item.score;
    } else if (typeof item.evaluation?.overallScore === "number") {
      score = item.evaluation.overallScore;
    }

    const id = item.id?.trim() || `post_${index + 1}`;

    return { id, text, score };
  }

  private extractJsonFromResult(result: string): string | null {
    // ```json ブロック
    const fencedJson = result.match(/```json\s*([\s\S]*?)\s*```/);
    if (fencedJson?.[1]) return fencedJson[1];

    // ``` ブロック（言語タグなし）内のJSON
    const fencedAny = result.match(/```\s*(\{[\s\S]*?\})\s*```/);
    if (fencedAny?.[1]) {
      try {
        JSON.parse(fencedAny[1]);
        return fencedAny[1];
      } catch {
        // JSONでなければスキップ
      }
    }

    let keywordIndex = result.indexOf('"posts"');
    if (keywordIndex === -1) {
      keywordIndex = result.indexOf('"candidates"');
    }
    if (keywordIndex === -1) return null;

    const startIndex = result.lastIndexOf("{", keywordIndex);
    if (startIndex === -1) return null;

    const endIndex = this.findMatchingBrace(result, startIndex);
    if (endIndex === -1) return null;

    return result.slice(startIndex, endIndex + 1);
  }

  private findMatchingBrace(text: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }

    return -1;
  }

  // --- ドメイン固有: tempファイル管理 ---

  private static readonly TEMP_DIRS = [
    ".claude/skills/x-algorithm-evaluate/temp",
    ".claude/skills/x-post-refine/temp",
    ".claude/skills/glm-generate/temp",
  ];

  private async clearTempFiles(): Promise<void> {
    for (const relDir of XOperationsWorkflow.TEMP_DIRS) {
      const dirPath = join(process.cwd(), relDir);
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          if (file.endsWith(".json")) {
            await fs.unlink(join(dirPath, file));
          }
        }
        console.log(`[${this.agentName}] Cleared temp: ${relDir}`);
      } catch {
        // ディレクトリが存在しない場合は無視
      }
    }
  }

  private static readonly TEMP_RESULT_PATHS = [
    ".claude/skills/x-algorithm-evaluate/temp/final-result.json",
    ".claude/skills/x-post-refine/temp/final-result.json",
  ];

  private async tryReadTempResult(): Promise<{
    posts: GeneratedPost[];
    bestPostId: string;
  } | null> {
    for (const relPath of XOperationsWorkflow.TEMP_RESULT_PATHS) {
      const filePath = join(process.cwd(), relPath);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const parsed = this.parseWorkflowResult(content);
        if (parsed && parsed.posts.length > 0) {
          console.log(
            `[${this.agentName}] Parsed posts from temp file: ${relPath}`,
          );
          return parsed;
        }
      } catch {
        // ファイルが存在しない場合は次を試す
      }
    }
    return null;
  }
}
