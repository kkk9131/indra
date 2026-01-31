import type { TaskRegistry } from "./registry.js";
import type { ScheduleStore } from "./store.js";
import type { TaskExecutionResult, ScheduledTask } from "./types.js";

/**
 * タスク実行結果コールバック
 */
export type ExecutionCallback = (result: TaskExecutionResult) => void;

/**
 * タスク実行エンジン
 */
export class TaskExecutor {
  private registry: TaskRegistry;
  private store: ScheduleStore;
  private onExecuted?: ExecutionCallback;

  constructor(
    registry: TaskRegistry,
    store: ScheduleStore,
    onExecuted?: ExecutionCallback,
  ) {
    this.registry = registry;
    this.store = store;
    this.onExecuted = onExecuted;
  }

  /**
   * タスクを実行
   */
  async execute(task: ScheduledTask): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const result: TaskExecutionResult = {
      taskId: task.id,
      success: false,
      executedAt: new Date().toISOString(),
    };

    const definition = this.registry.get(task.taskType);
    if (!definition) {
      result.error = `Unknown task type: ${task.taskType}`;
      this.notifyExecuted(result);
      return result;
    }

    try {
      console.log(
        `TaskExecutor: Executing task "${task.name}" (${task.taskType})`,
      );
      await definition.execute();
      result.success = true;
      result.duration = Date.now() - startTime;

      // 最終実行時刻を更新
      this.store.updateLastRunAt(task.id);

      console.log(
        `TaskExecutor: Task "${task.name}" completed in ${result.duration}ms`,
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
      result.duration = Date.now() - startTime;
      console.error(`TaskExecutor: Task "${task.name}" failed:`, error);
    }

    this.notifyExecuted(result);
    return result;
  }

  /**
   * タスクIDで実行
   */
  async executeById(taskId: string): Promise<TaskExecutionResult> {
    const task = this.store.get(taskId);
    if (!task) {
      const result: TaskExecutionResult = {
        taskId,
        success: false,
        error: `Task not found: ${taskId}`,
        executedAt: new Date().toISOString(),
      };
      this.notifyExecuted(result);
      return result;
    }

    return this.execute(task);
  }

  /**
   * タスクタイプで実行
   */
  async executeByType(taskType: string): Promise<TaskExecutionResult> {
    const task = this.store.findByType(taskType);
    if (!task) {
      const result: TaskExecutionResult = {
        taskId: "",
        success: false,
        error: `No task found for type: ${taskType}`,
        executedAt: new Date().toISOString(),
      };
      this.notifyExecuted(result);
      return result;
    }

    return this.execute(task);
  }

  /**
   * 実行コールバックを設定
   */
  setExecutionCallback(callback: ExecutionCallback): void {
    this.onExecuted = callback;
  }

  private notifyExecuted(result: TaskExecutionResult): void {
    if (this.onExecuted) {
      this.onExecuted(result);
    }
  }
}
