/**
 * X運用ワークフロー
 *
 * 記事からXポストを作成するワークフローを管理
 *
 * レポート機能と同様にClaude Agent SDKでスキルを呼び出す方式:
 * - chatStreamWithAgentでエージェントを実行
 * - プロンプトでスキル（x-post-compose等）を指示
 * - Claudeが自動でSkillツールを使用
 */

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

  /**
   * 記事からXポストを作成
   */
  async createPost(article: NewsArticle): Promise<XPostResult> {
    console.log(`[XOperationsWorkflow] Starting createPost for: ${article.id}`);

    // 冪等性チェック
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
      console.log(`[XOperationsWorkflow] Starting run for: ${article.id}`);
      // 1. 実行開始を記録
      const run = await this.registry.start("x-operations-agent", {
        articleId: article.id,
        articleTitle: article.title,
      });
      console.log(`[XOperationsWorkflow] Run started: ${run.id}`);

      // 2. チェックポイント初期化
      const initialCheckpoint: XPostCheckpoint = {
        articleId: article.id,
        phase: "analyzing",
        refinementCount: 0,
      };
      await this.registry.updateCheckpoint(
        run.id,
        initialCheckpoint as unknown as Record<string, unknown>,
      );

      // 3. ワークフロー実行
      const result = await this.executeWorkflow(run.id, article);

      // 6. 結果を記録
      this.idempotency.recordSuccess(idempotencyKey, result);

      return result;
    } catch (error) {
      // 失敗時は冪等キーをクリア（再試行を許可）
      this.idempotency.clearOnFailure(idempotencyKey);
      throw error;
    }
  }

  /**
   * ワークフローを実行（レポート機能と同じ方式）
   *
   * Claude Agent SDKでスキルを呼び出す:
   * - x-post-compose: ポスト生成
   * - x-algorithm-evaluate: 評価
   * - x-post-refine: 改善
   */
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

    // エージェント定義を取得（agents.ts から）
    const agents = await createXOperationsAgents();
    const agentDef = agents["x-operations-agent"];

    // Phase: Generating
    await this.registry.updateCheckpoint(runId, { phase: "generating" });

    // Agent SDK で X運用スキルを呼び出し
    const prompt = `x-post-compose スキルを使って、以下の記事から5つのX投稿候補を生成してください。
その後、x-algorithm-evaluate スキルで評価し、上位3つを選定してください。
最後に、x-post-refine スキルで各ポストを改善してください。

## 記事情報
タイトル: ${article.title}
URL: ${article.url}
${article.summary ? `要約: ${article.summary}` : ""}

本文:
${article.content.slice(0, 2000)}${article.content.length > 2000 ? "..." : ""}

## 出力形式
最終的に以下のJSON形式で結果を出力してください:
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
      if (event.type === "tool_start") {
        console.log(`[XOperationsWorkflow] Tool start: ${event.tool}`);
        // フェーズ更新
        if (event.tool === "Skill") {
          const skillArg = String(event.input ?? "");
          if (skillArg.includes("evaluate")) {
            await this.registry.updateCheckpoint(runId, {
              phase: "evaluating",
            });
          } else if (skillArg.includes("refine")) {
            await this.registry.updateCheckpoint(runId, { phase: "refining" });
          }
        }
      } else if (event.type === "tool_result") {
        console.log(
          `[XOperationsWorkflow] Tool result: ${event.tool} -> ${event.result.slice(0, 100)}...`,
        );
      } else if (event.type === "turn_complete") {
        console.log(`[XOperationsWorkflow] Turn ${event.turnNumber} complete`);
      } else if (event.type === "done") {
        console.log(
          `[XOperationsWorkflow] Done: ${event.result.slice(0, 200)}...`,
        );
        finalResult = event.result;
      } else if (event.type === "cancelled") {
        console.log(`[XOperationsWorkflow] Cancelled: ${event.reason}`);
      }
    }

    // 結果をパース
    const parsed = this.parseWorkflowResult(finalResult);

    if (!parsed || parsed.posts.length === 0) {
      // フォールバック
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

    // 承認待ちに登録
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

  /**
   * ワークフロー結果をパース
   */
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

  /**
   * 未完了のワークフローを復旧
   */
  async recoverPendingRuns(): Promise<void> {
    const pending = await this.registry.getPending();

    for (const run of pending) {
      const checkpoint = run.checkpoint as unknown as XPostCheckpoint;

      if (checkpoint.phase === "completed") {
        // 完了状態だがステータスが未更新
        await this.registry.complete(run.id);
        console.log(`Recovered completed run: ${run.id}`);
      } else {
        // 途中で中断されたタスク
        console.log(
          `Found interrupted run: ${run.id}, phase: ${checkpoint.phase}`,
        );
        // 自動復旧はせず、ログのみ
        // 必要に応じて手動で再実行または破棄を判断
      }
    }
  }
}
