/**
 * リサーチエージェント
 *
 * トピック調査・レポート作成を統括
 */

export {
  createResearchAgents,
  toSDKAgentFormat,
  type ResearchAgentDefinition,
} from "./agents.js";

export {
  loadResearchSkills,
  skillToToolDescription,
  buildSkillsPrompt,
  type SkillDefinition,
} from "./skills-loader.js";

export {
  ResearchWorkflow,
  type ResearchPhase,
  type ResearchCheckpoint,
  type ResearchConfig,
  type ResearchResult,
} from "./workflow.js";

import { runRegistry } from "../subagent/index.js";
import { ResearchWorkflow } from "./workflow.js";

/**
 * デフォルトのリサーチワークフローインスタンス
 */
export const researchWorkflow = new ResearchWorkflow(runRegistry);

/**
 * 起動時の復旧処理
 */
export async function initializeResearch(): Promise<void> {
  await runRegistry.loadFromStore();
  await researchWorkflow.recoverPendingRuns();
}
