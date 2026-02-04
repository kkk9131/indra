/**
 * X運用エージェント
 *
 * X(Twitter)投稿作成・評価・改善を統括
 */

export {
  createXOperationsAgents,
  toSDKAgentFormat,
  type XOperationsAgentDefinition,
} from "./agents.js";

export {
  loadXOperationsSkills,
  listAvailableSkills,
  skillToToolDescription,
  buildSkillsPrompt,
  type SkillDefinition,
} from "./skills-loader.js";

export {
  IdempotencyManager,
  idempotencyManager,
  type IdempotencyRecord,
} from "./idempotency.js";

export type {
  XPostCheckpoint,
  GeneratedPost,
  PostEvaluationResult,
} from "./types.js";

export {
  XOperationsWorkflow,
  type NewsArticle,
  type XPostResult,
} from "./workflow.js";

import { runRegistry } from "../subagent/index.js";
import { idempotencyManager } from "./idempotency.js";
import { XOperationsWorkflow } from "./workflow.js";

/**
 * デフォルトのX運用ワークフローインスタンス
 */
export const xOperationsWorkflow = new XOperationsWorkflow(
  runRegistry,
  idempotencyManager,
);

/**
 * 起動時の復旧処理
 */
export async function initializeXOperations(): Promise<void> {
  // 永続化ストアから読み込み
  await runRegistry.loadFromStore();

  // 未完了タスクを確認
  await xOperationsWorkflow.recoverPendingRuns();
}
