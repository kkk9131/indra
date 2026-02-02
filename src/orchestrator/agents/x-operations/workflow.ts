import type { LLMProvider } from "../../llm/index.js";
import {
  type RunRegistry,
  type XPostCheckpoint,
  type GeneratedPost,
} from "../subagent/index.js";
import { IdempotencyManager } from "./idempotency.js";
import { ApprovalQueue } from "../../../platform/approval/queue.js";
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

export class XOperationsWorkflow {
  private approvalQueue: ApprovalQueue;
  private llmProvider: LLMProvider | null = null;

  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  constructor(
    private registry: RunRegistry,
    private idempotency: IdempotencyManager,
    approvalQueue?: ApprovalQueue,
  ) {
    this.approvalQueue = approvalQueue ?? new ApprovalQueue();
  }

  async createPost(article: NewsArticle): Promise<XPostResult> {
    console.log(`[XOperationsWorkflow] Starting createPost for: ${article.id}`);

    const idempotencyKey = this.idempotency.generateKey(
      article.id,
      "create-post",
    );
    const idempotencyCheck = this.idempotency.checkAndSet(idempotencyKey);

    if (idempotencyCheck.alreadyExecuted) {
      console.log(`[XOperationsWorkflow] Already executed: ${article.id}`);
      return idempotencyCheck.result as XPostResult;
    }

    try {
      const run = await this.registry.start("x-operations-agent", {
        articleId: article.id,
        articleTitle: article.title,
      });
      console.log(`[XOperationsWorkflow] Run started: ${run.id}`);

      const initialCheckpoint: XPostCheckpoint = {
        articleId: article.id,
        phase: "analyzing",
        refinementCount: 0,
      };
      await this.registry.updateCheckpoint(
        run.id,
        initialCheckpoint as unknown as Record<string, unknown>,
      );

      const result = await this.executeWorkflow(run.id, article);
      this.idempotency.recordSuccess(idempotencyKey, result);

      return result;
    } catch (error) {
      this.idempotency.clearOnFailure(idempotencyKey);
      throw error;
    }
  }

  private async executeWorkflow(
    runId: string,
    article: NewsArticle,
  ): Promise<XPostResult> {
    console.log(`[XOperationsWorkflow] executeWorkflow started: ${runId}`);

    if (!this.llmProvider?.chatStreamWithAgent) {
      return {
        success: false,
        runId,
        error: "LLM provider with agent support not configured",
      };
    }

    const agents = await createXOperationsAgents();
    const agentDef = agents["x-operations-agent"];

    await this.registry.updateCheckpoint(runId, { phase: "generating" });

    const prompt = `以下の記事からX投稿を作成してください。

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

## 最終出力形式
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

    console.log(
      `[XOperationsWorkflow] Starting with prompt: ${prompt.slice(0, 100)}...`,
    );
    console.log(
      `[XOperationsWorkflow] Agent tools: ${agentDef.tools?.join(", ") ?? "none"}`,
    );

    let finalResult = "";
    for await (const event of this.llmProvider.chatStreamWithAgent(
      [{ role: "user", content: prompt }],
      {
        systemPrompt: agentDef.prompt,
        agent: {
          maxTurns: 15,
          tools: agentDef.tools,
          permissionMode: "acceptEdits",
        },
      },
    )) {
      switch (event.type) {
        case "tool_start":
          console.log(`[XOperationsWorkflow] Tool start: ${event.tool}`);
          if (event.tool === "Skill") {
            const skillArg = String(event.input ?? "");
            if (skillArg.includes("evaluate")) {
              await this.registry.updateCheckpoint(runId, {
                phase: "evaluating",
              });
            } else if (skillArg.includes("refine")) {
              await this.registry.updateCheckpoint(runId, {
                phase: "refining",
              });
            }
          }
          break;
        case "tool_result":
          console.log(
            `[XOperationsWorkflow] Tool result: ${event.tool} -> ${event.result.slice(0, 100)}...`,
          );
          break;
        case "turn_complete":
          console.log(
            `[XOperationsWorkflow] Turn ${event.turnNumber} complete`,
          );
          break;
        case "done":
          console.log(
            `[XOperationsWorkflow] Done: ${event.result.slice(0, 200)}...`,
          );
          finalResult = event.result;
          break;
        case "cancelled":
          console.log(`[XOperationsWorkflow] Cancelled: ${event.reason}`);
          break;
      }
    }

    const parsed = this.parseWorkflowResult(finalResult);

    if (!parsed || parsed.posts.length === 0) {
      console.log(
        `[XOperationsWorkflow] Failed to parse result, using fallback`,
      );
      const fallbackPost: GeneratedPost = {
        id: `post_${Date.now()}_1`,
        text: `【${article.title}】\n\n要点をまとめました\n\n詳細はリプライで`,
        score: 60,
      };

      await this.registry.updateCheckpoint(runId, {
        phase: "pending_approval",
        generatedPosts: [fallbackPost],
        bestPostId: fallbackPost.id,
      });

      this.approvalQueue.create({
        platform: "x",
        content: { text: fallbackPost.text },
        prompt: `記事「${article.title}」から生成（フォールバック）`,
        metadata: {
          runId,
          articleId: article.id,
          articleTitle: article.title,
          score: fallbackPost.score,
          allPosts: [fallbackPost],
        },
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

    this.approvalQueue.create({
      platform: "x",
      content: { text: bestPost.text },
      prompt: `記事「${article.title}」から生成`,
      metadata: {
        runId,
        articleId: article.id,
        articleTitle: article.title,
        score: bestPost.score,
        allPosts: generatedPosts,
      },
    });

    return {
      success: true,
      runId,
      allPosts: generatedPosts,
      bestPost,
    };
  }

  private parseWorkflowResult(result: string): {
    posts: GeneratedPost[];
    bestPostId: string;
  } | null {
    try {
      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[1]);
      if (!parsed.posts || !Array.isArray(parsed.posts)) return null;

      return {
        posts: parsed.posts.map(
          (p: { id: string; text: string; score?: number }) => ({
            id: p.id,
            text: p.text,
            score: p.score,
          }),
        ),
        bestPostId: parsed.bestPostId ?? parsed.posts[0]?.id,
      };
    } catch {
      return null;
    }
  }

  async recoverPendingRuns(): Promise<void> {
    const pending = await this.registry.getPending();

    for (const run of pending) {
      const checkpoint = run.checkpoint as unknown as XPostCheckpoint;

      if (checkpoint.phase === "completed") {
        await this.registry.complete(run.id);
        console.log(`Recovered completed run: ${run.id}`);
      } else {
        console.log(
          `Found interrupted run: ${run.id}, phase: ${checkpoint.phase}`,
        );
      }
    }
  }
}
