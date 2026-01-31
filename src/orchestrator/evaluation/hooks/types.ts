import type {
  OutcomeType,
  OutcomeStage,
  OutcomeContent,
} from "../../../platform/logs/types.js";

export interface OutcomeLogEntry {
  id: string;
  outcomeId: string;
  executionId?: string | null;
  sessionId?: string | null;
  outcomeType: OutcomeType;
  outcomeStage: OutcomeStage;
  content: OutcomeContent;
  previousOutcomeId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface EvaluationHook {
  onOutcomeSaved(outcomeLog: OutcomeLogEntry): Promise<void>;
}

export interface AutoEvaluatorConfig {
  enabled?: boolean;
  finalOnly?: boolean;
  autoCreateTasks?: OutcomeType[];
}

export const DEFAULT_AUTO_EVALUATOR_CONFIG: Required<AutoEvaluatorConfig> = {
  enabled: true,
  finalOnly: true,
  autoCreateTasks: ["xpost", "report"],
};
