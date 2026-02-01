/**
 * X運用ワークフロー
 *
 * 記事からXポストを作成するワークフローを管理
 */

import {
  type RunRegistry,
  type XPostCheckpoint,
  type GeneratedPost,
  createRegistryHooksWithErrorHandling,
} from "../subagent/index.js";
import { IdempotencyManager } from "./idempotency.js";
import { createXOperationsAgents, toSDKAgentFormat } from "./agents.js";

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
  posts?: GeneratedPost[];
  bestPost?: GeneratedPost;
  error?: string;
}

export class XOperationsWorkflow {
  constructor(
    private registry: RunRegistry,
    private idempotency: IdempotencyManager,
  ) {}

  /**
   * 記事からXポストを作成
   */
  async createPost(article: NewsArticle): Promise<XPostResult> {
    // 冪等性チェック
    const idempotencyKey = this.idempotency.generateKey(
      article.id,
      "create-post",
    );
    const idempotencyCheck = this.idempotency.checkAndSet(idempotencyKey);

    if (idempotencyCheck.alreadyExecuted) {
      return idempotencyCheck.result as XPostResult;
    }

    try {
      // 1. 実行開始を記録
      const run = await this.registry.start("x-operations-agent", {
        articleId: article.id,
        articleTitle: article.title,
      });

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

      // 3. サブエージェント定義を作成
      const agents = await createXOperationsAgents();
      const sdkAgents = toSDKAgentFormat(agents);

      // 4. フック設定
      const hooks = createRegistryHooksWithErrorHandling(
        this.registry,
        run.id,
        (error) => console.error("Hook error:", error),
      );

      // 5. ワークフロー実行（SDK呼び出しは実際の実装で行う）
      const result = await this.executeWorkflow(
        run.id,
        article,
        sdkAgents,
        hooks,
      );

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
   * ワークフローを実行
   * 注: 実際のSDK呼び出しは外部から注入される想定
   */
  private async executeWorkflow(
    runId: string,
    article: NewsArticle,
    _agents: Record<string, unknown>,
    _hooks: unknown,
  ): Promise<XPostResult> {
    // Phase 1: Analyzing
    await this.registry.updateCheckpoint(runId, { phase: "analyzing" });

    // Phase 2: Generating
    await this.registry.updateCheckpoint(runId, { phase: "generating" });

    // 仮の生成結果（実際はSDK呼び出しで生成）
    const generatedPosts: GeneratedPost[] = [
      {
        id: `post_${Date.now()}_1`,
        content: `【${article.title}】\n\n要点をまとめました\n\n詳細はリプライで`,
      },
      {
        id: `post_${Date.now()}_2`,
        content: `${article.title}が話題\n\nこれは要チェック`,
      },
      {
        id: `post_${Date.now()}_3`,
        content: `🚀 ${article.title}\n\n個人開発者として注目してます`,
      },
    ];

    await this.registry.updateCheckpoint(runId, {
      phase: "evaluating",
      generatedPosts,
    });

    // Phase 3: Evaluating
    // 仮の評価結果
    generatedPosts[0].score = 72;
    generatedPosts[1].score = 65;
    generatedPosts[2].score = 78;

    const bestPost = generatedPosts.reduce((a, b) =>
      (a.score ?? 0) > (b.score ?? 0) ? a : b,
    );

    await this.registry.updateCheckpoint(runId, {
      phase: "completed",
      bestPostId: bestPost.id,
    });

    await this.registry.complete(runId);

    return {
      success: true,
      runId,
      posts: generatedPosts,
      bestPost,
    };
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
