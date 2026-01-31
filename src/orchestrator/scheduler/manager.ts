import cron from "node-cron";

import type { ScheduleStore } from "./store.js";
import type { TaskRegistry } from "./registry.js";
import type { TaskExecutor } from "./executor.js";
import type {
  ScheduledTask,
  CreateTaskParams,
  UpdateTaskParams,
  TaskDefinition,
} from "./types.js";

/**
 * スケジューラーマネージャー
 * cronジョブの動的管理を担当
 */
export class SchedulerManager {
  private store: ScheduleStore;
  private registry: TaskRegistry;
  private executor: TaskExecutor;
  private jobs = new Map<string, cron.ScheduledTask>();
  private onTaskUpdated?: (task: ScheduledTask) => void;

  constructor(
    store: ScheduleStore,
    registry: TaskRegistry,
    executor: TaskExecutor,
    onTaskUpdated?: (task: ScheduledTask) => void,
  ) {
    this.store = store;
    this.registry = registry;
    this.executor = executor;
    this.onTaskUpdated = onTaskUpdated;
  }

  /**
   * すべての有効なタスクのcronジョブを開始
   */
  start(): void {
    console.log("SchedulerManager: Starting...");
    const tasks = this.store.listEnabled();

    for (const task of tasks) {
      this.scheduleTask(task);
    }

    console.log(`SchedulerManager: Started ${tasks.length} tasks`);
  }

  /**
   * すべてのcronジョブを停止
   */
  stop(): void {
    console.log("SchedulerManager: Stopping...");

    for (const [taskId, job] of this.jobs) {
      job.stop();
      console.log(`SchedulerManager: Stopped job for task ${taskId}`);
    }

    this.jobs.clear();
    console.log("SchedulerManager: Stopped");
  }

  /**
   * タスクをスケジュール
   */
  private scheduleTask(task: ScheduledTask): void {
    // 既存のジョブがあれば停止
    const existingJob = this.jobs.get(task.id);
    if (existingJob) {
      existingJob.stop();
    }

    if (!task.enabled) {
      this.jobs.delete(task.id);
      return;
    }

    // cron式のバリデーション
    if (!cron.validate(task.cronExpression)) {
      console.error(
        `SchedulerManager: Invalid cron expression for task ${task.id}: ${task.cronExpression}`,
      );
      return;
    }

    // 新しいジョブを作成
    const job = cron.schedule(task.cronExpression, () => {
      this.executor.execute(task).catch((error) => {
        console.error(
          `SchedulerManager: Error executing task ${task.id}:`,
          error,
        );
      });
    });

    this.jobs.set(task.id, job);
    console.log(
      `SchedulerManager: Scheduled task "${task.name}" with cron: ${task.cronExpression}`,
    );
  }

  /**
   * タスクを再スケジュール
   */
  private rescheduleTask(taskId: string): void {
    const task = this.store.get(taskId);
    if (task) {
      this.scheduleTask(task);
    } else {
      // タスクが削除された場合、ジョブも削除
      const job = this.jobs.get(taskId);
      if (job) {
        job.stop();
        this.jobs.delete(taskId);
      }
    }
  }

  // ===== CRUD API =====

  /**
   * タスク一覧を取得
   */
  list(): ScheduledTask[] {
    return this.store.list();
  }

  /**
   * タスクを取得
   */
  get(id: string): ScheduledTask | null {
    return this.store.get(id);
  }

  /**
   * タスクを作成
   */
  create(params: CreateTaskParams): ScheduledTask {
    // タスクタイプの検証
    if (!this.registry.has(params.taskType)) {
      throw new Error(`Unknown task type: ${params.taskType}`);
    }

    // cron式の検証
    if (!cron.validate(params.cronExpression)) {
      throw new Error(`Invalid cron expression: ${params.cronExpression}`);
    }

    const task = this.store.create(params);

    // 有効な場合はスケジュール
    if (task.enabled) {
      this.scheduleTask(task);
    }

    this.notifyTaskUpdated(task);
    return task;
  }

  /**
   * タスクを更新
   */
  update(id: string, params: UpdateTaskParams): ScheduledTask | null {
    // cron式が変更される場合は検証
    if (params.cronExpression && !cron.validate(params.cronExpression)) {
      throw new Error(`Invalid cron expression: ${params.cronExpression}`);
    }

    const task = this.store.update(id, params);
    if (task) {
      this.rescheduleTask(id);
      this.notifyTaskUpdated(task);
    }
    return task;
  }

  /**
   * タスクを削除
   */
  delete(id: string): boolean {
    // ジョブを停止
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
    }

    return this.store.delete(id);
  }

  /**
   * タスクの有効/無効を切り替え
   */
  toggle(id: string, enabled: boolean): ScheduledTask | null {
    const task = this.store.toggle(id, enabled);
    if (task) {
      this.rescheduleTask(id);
      this.notifyTaskUpdated(task);
    }
    return task;
  }

  /**
   * タスクを即時実行
   */
  async runNow(id: string): Promise<{ success: boolean; error?: string }> {
    const task = this.store.get(id);
    if (!task) {
      return { success: false, error: `Task not found: ${id}` };
    }

    const result = await this.executor.execute(task);

    // タスク更新を通知
    const updatedTask = this.store.get(id);
    if (updatedTask) {
      this.notifyTaskUpdated(updatedTask);
    }

    return {
      success: result.success,
      error: result.error,
    };
  }

  // ===== Registry API =====

  /**
   * タスク定義を登録
   */
  registerTaskType(definition: TaskDefinition): void {
    this.registry.register(definition);
  }

  /**
   * 登録済みタスクタイプ一覧を取得
   */
  taskTypes(): TaskDefinition[] {
    return this.registry.list();
  }

  // ===== Helper Methods =====

  private notifyTaskUpdated(task: ScheduledTask): void {
    if (this.onTaskUpdated) {
      this.onTaskUpdated(task);
    }
  }

  /**
   * デフォルトタスクを登録（存在しない場合のみ）
   */
  ensureDefaultTask(
    taskType: string,
    name: string,
    description: string,
    defaultCron: string,
  ): ScheduledTask {
    const existing = this.store.findByType(taskType);
    if (existing) {
      return existing;
    }

    return this.create({
      name,
      description,
      taskType,
      cronExpression: defaultCron,
      enabled: true,
    });
  }
}
