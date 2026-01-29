import {
  EvaluationStore,
  calculateMetrics,
  GLMGrader,
  DEFAULT_K,
} from "../../evaluation/index.js";
import type {
  Task,
  Trial,
  GraderResult,
  EvaluationMetrics,
  CreateTaskInput,
  TaskWithMetrics,
  TrialWithResults,
} from "../../evaluation/types.js";

export interface EvaluationServiceConfig {
  dataDir?: string;
}

export class EvaluationService {
  private store: EvaluationStore;
  private grader: GLMGrader;

  constructor(config: EvaluationServiceConfig = {}) {
    this.store = new EvaluationStore(config.dataDir);
    this.grader = new GLMGrader();
  }

  // ===== Task Operations =====

  createTask(input: CreateTaskInput): Task {
    return this.store.createTask(input);
  }

  getTask(id: string): Task | null {
    return this.store.getTask(id);
  }

  listTasks(): Task[] {
    return this.store.listTasks();
  }

  listTasksByType(taskType: string): Task[] {
    return this.store.listTasksByType(taskType);
  }

  listTasksWithMetrics(k: number = DEFAULT_K): TaskWithMetrics[] {
    const tasks = this.store.listTasks();
    return tasks.map((task) => ({
      ...task,
      metrics: this.getTaskMetrics(task.id, k),
    }));
  }

  updateTask(id: string, updates: Partial<CreateTaskInput>): Task | null {
    return this.store.updateTask(id, updates);
  }

  deleteTask(id: string): boolean {
    return this.store.deleteTask(id);
  }

  // ===== Trial Operations =====

  createTrial(
    taskId: string,
    executionId?: string,
    sessionId?: string,
    outcomeId?: string,
  ): Trial {
    return this.store.createTrial({
      taskId,
      executionId,
      sessionId,
      outcomeId,
    });
  }

  getTrial(id: string): Trial | null {
    return this.store.getTrial(id);
  }

  listTrialsByTask(taskId: string): Trial[] {
    return this.store.listTrialsByTask(taskId);
  }

  getTrialByExecutionId(executionId: string): Trial | null {
    return this.store.getTrialByExecutionId(executionId);
  }

  updateTrialResult(
    id: string,
    passed: boolean,
    duration?: number,
  ): Trial | null {
    return this.store.updateTrialResult(id, passed, duration);
  }

  getTrialWithResults(trialId: string): TrialWithResults | null {
    return this.store.getTrialWithResults(trialId);
  }

  // ===== Grading Operations =====

  isGraderAvailable(): boolean {
    return this.grader.isAvailable();
  }

  async runGrading(
    taskId: string,
    outcome: string,
    executionId?: string,
    sessionId?: string,
    outcomeId?: string,
  ): Promise<{
    trial: Trial;
    graderResult: GraderResult;
  }> {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!this.grader.isAvailable()) {
      throw new Error("GLM grader is not available. Please set ZAI_API_KEY.");
    }

    // Create trial
    const trial = this.store.createTrial({
      taskId,
      executionId,
      sessionId,
      outcomeId,
    });

    // Run grading
    const start = Date.now();
    const gradeInput = await this.grader.gradeForStorage(
      trial.id,
      task,
      outcome,
    );
    const duration = Date.now() - start;

    // Record result
    const graderResult = this.store.recordGraderResult(gradeInput);

    // Update trial
    this.store.updateTrialResult(trial.id, gradeInput.passed, duration);

    return {
      trial: { ...trial, passed: gradeInput.passed, duration },
      graderResult,
    };
  }

  // ===== Metrics Operations =====

  getTaskMetrics(
    taskId: string,
    k: number = DEFAULT_K,
  ): EvaluationMetrics | null {
    const task = this.store.getTask(taskId);
    if (!task) return null;

    return calculateMetrics(this.store, taskId, k);
  }

  getTaskStats(taskId: string): { total: number; passed: number } {
    return this.store.getTaskTrialStats(taskId);
  }

  // ===== Grader Result Operations =====

  listGraderResultsByTrial(trialId: string): GraderResult[] {
    return this.store.listGraderResultsByTrial(trialId);
  }

  // ===== Cleanup =====

  close(): void {
    this.store.close();
  }
}
