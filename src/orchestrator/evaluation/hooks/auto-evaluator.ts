import type {
  EvaluationHook,
  OutcomeLogEntry,
  AutoEvaluatorConfig,
} from "./types.js";
import { DEFAULT_AUTO_EVALUATOR_CONFIG } from "./types.js";
import type { EvaluationStore } from "../store.js";
import type { Task, TaskType } from "../types.js";
import { GLMGrader } from "../graders/glm-grader.js";
import type {
  OutcomeType,
  OutcomeContent,
} from "../../../platform/logs/types.js";

const OUTCOME_TYPE_TO_TASK_TYPE: Record<OutcomeType, TaskType> = {
  xpost: "xpost",
  report: "report",
  chat: "chat",
  file: "other",
  other: "other",
};

function extractOutcomeText(
  content: OutcomeContent,
  outcomeType: OutcomeType,
): string {
  if (outcomeType === "xpost" && content.posts?.length) {
    return content.posts.map((p) => p.text).join("\n---\n");
  }
  if (outcomeType === "report" && content.report) {
    return `# ${content.report.title}\n\n${content.report.summary}`;
  }
  if (outcomeType === "chat" && content.finalResponse) {
    return content.finalResponse;
  }
  if (outcomeType === "file" && content.files?.length) {
    return content.files.map((f) => `${f.path} (${f.size} bytes)`).join("\n");
  }
  return JSON.stringify(content);
}

export class AutoEvaluator implements EvaluationHook {
  private store: EvaluationStore;
  private grader: GLMGrader;
  private config: Required<AutoEvaluatorConfig>;

  constructor(
    store: EvaluationStore,
    grader?: GLMGrader,
    config?: AutoEvaluatorConfig,
  ) {
    this.store = store;
    this.grader = grader ?? new GLMGrader();
    this.config = { ...DEFAULT_AUTO_EVALUATOR_CONFIG, ...config };
  }

  private shouldEvaluate(outcomeLog: OutcomeLogEntry): boolean {
    if (!this.config.enabled) {
      return false;
    }
    if (this.config.finalOnly && outcomeLog.outcomeStage !== "final") {
      return false;
    }
    if (!this.grader.isAvailable()) {
      console.log("AutoEvaluator: GLM grader not available, skipping");
      return false;
    }
    return true;
  }

  private findOrCreateTask(outcomeLog: OutcomeLogEntry): Task | null {
    const taskType = OUTCOME_TYPE_TO_TASK_TYPE[outcomeLog.outcomeType];
    const existingTasks = this.store.listTasksByType(taskType);

    if (outcomeLog.executionId) {
      const matchingTask = existingTasks.find(
        (t) =>
          t.input.includes(outcomeLog.executionId!) ||
          t.name.includes(outcomeLog.executionId!.slice(0, 8)),
      );
      if (matchingTask) return matchingTask;
    }

    if (existingTasks.length > 0) {
      return existingTasks[0];
    }

    if (this.config.autoCreateTasks.includes(outcomeLog.outcomeType)) {
      return this.store.createTask({
        name: `Auto: ${outcomeLog.outcomeType} evaluation`,
        taskType,
        input: `Auto-generated task for ${outcomeLog.outcomeType} outcomes`,
        successCriteria: this.getDefaultSuccessCriteria(taskType),
      });
    }

    return null;
  }

  private getDefaultSuccessCriteria(taskType: TaskType): string {
    switch (taskType) {
      case "xpost":
        return "投稿は280文字以内で、エンゲージメントを促す内容であること。不適切な内容がないこと。";
      case "report":
        return "レポートは構造が適切で、情報価値があり、出典が明記されていること。";
      case "chat":
        return "質問に適切に回答し、明確で理解しやすい内容であること。";
      case "browser":
        return "目的の操作が成功し、危険な操作が含まれていないこと。";
      default:
        return "タスクの目的を達成していること。";
    }
  }

  async onOutcomeSaved(outcomeLog: OutcomeLogEntry): Promise<void> {
    if (!this.shouldEvaluate(outcomeLog)) {
      return;
    }

    console.log(
      `AutoEvaluator: Processing outcome ${outcomeLog.outcomeId} (${outcomeLog.outcomeType})`,
    );

    try {
      const task = this.findOrCreateTask(outcomeLog);
      if (!task) {
        console.log(
          `AutoEvaluator: No task found for outcome type ${outcomeLog.outcomeType}, skipping`,
        );
        return;
      }

      const outcomeText = extractOutcomeText(
        outcomeLog.content,
        outcomeLog.outcomeType,
      );
      const trial = this.store.createTrial({
        taskId: task.id,
        executionId: outcomeLog.executionId ?? undefined,
        sessionId: outcomeLog.sessionId ?? undefined,
        outcomeId: outcomeLog.outcomeId,
      });

      const start = Date.now();
      const gradeInput = await this.grader.gradeForStorage(
        trial.id,
        task,
        outcomeText,
      );
      const duration = Date.now() - start;

      this.store.recordGraderResult(gradeInput);
      this.store.updateTrialResult(trial.id, gradeInput.passed, duration);

      console.log(
        `AutoEvaluator: Evaluated outcome ${outcomeLog.outcomeId} - ` +
          `${gradeInput.passed ? "PASSED" : "FAILED"} (score: ${gradeInput.score})`,
      );
    } catch (error) {
      console.error(
        `AutoEvaluator: Failed to evaluate outcome ${outcomeLog.outcomeId}:`,
        error,
      );
    }
  }
}
