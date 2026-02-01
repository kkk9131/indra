/**
 * スケジュールタスクの型定義
 */

/**
 * スケジュールされたタスク
 */
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  taskType: string; // "news" | "analytics" | 将来の任意タスク
  cronExpression: string; // "0 6 * * *"
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  config?: Record<string, unknown>; // タスク固有設定
  createdAt: string;
  updatedAt: string;
}

/**
 * タスク作成用パラメータ
 */
export interface CreateTaskParams {
  name: string;
  description?: string;
  taskType: string;
  cronExpression: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

/**
 * タスク更新用パラメータ
 */
export interface UpdateTaskParams {
  name?: string;
  description?: string;
  cronExpression?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

/**
 * タスク固有設定のフィールド定義
 */
export interface ConfigFieldDefinition {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "boolean";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: unknown;
}

/**
 * タスク定義（レジストリに登録する形式）
 */
export interface TaskDefinition {
  type: string;
  name: string;
  description: string;
  execute: (config?: Record<string, unknown>) => Promise<void>;
  defaultCron?: string;
  configSchema?: ConfigFieldDefinition[];
}

/**
 * タスク実行結果
 */
export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  error?: string;
  executedAt: string;
  duration?: number;
}
