import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CronExpressionParser } from "cron-parser";

import type {
  ScheduledTask,
  CreateTaskParams,
  UpdateTaskParams,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../../data/sessions.db");

/**
 * スケジュールストア（SQLite CRUD）
 */
export class ScheduleStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath ?? DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        task_type TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        config TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  /**
   * 次回実行時刻を計算
   */
  private calculateNextRunAt(cronExpression: string): string | undefined {
    try {
      const interval = CronExpressionParser.parse(cronExpression);
      const nextDate = interval.next().toISOString();
      return nextDate ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * タスク一覧を取得
   */
  list(): ScheduledTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_tasks ORDER BY created_at DESC
    `);
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      description: string | null;
      task_type: string;
      cron_expression: string;
      enabled: number;
      last_run_at: string | null;
      next_run_at: string | null;
      config: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      taskType: row.task_type,
      cronExpression: row.cron_expression,
      enabled: row.enabled === 1,
      lastRunAt: row.last_run_at ?? undefined,
      nextRunAt: row.next_run_at ?? undefined,
      config: row.config ? JSON.parse(row.config) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * タスクを取得
   */
  get(id: string): ScheduledTask | null {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_tasks WHERE id = ?
    `);
    const row = stmt.get(id) as
      | {
          id: string;
          name: string;
          description: string | null;
          task_type: string;
          cron_expression: string;
          enabled: number;
          last_run_at: string | null;
          next_run_at: string | null;
          config: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      taskType: row.task_type,
      cronExpression: row.cron_expression,
      enabled: row.enabled === 1,
      lastRunAt: row.last_run_at ?? undefined,
      nextRunAt: row.next_run_at ?? undefined,
      config: row.config ? JSON.parse(row.config) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * タスクを作成
   */
  create(params: CreateTaskParams): ScheduledTask {
    const id = randomUUID();
    const now = new Date().toISOString();
    const nextRunAt =
      params.enabled !== false
        ? this.calculateNextRunAt(params.cronExpression)
        : undefined;

    const stmt = this.db.prepare(`
      INSERT INTO scheduled_tasks (
        id, name, description, task_type, cron_expression,
        enabled, next_run_at, config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.name,
      params.description ?? null,
      params.taskType,
      params.cronExpression,
      params.enabled !== false ? 1 : 0,
      nextRunAt ?? null,
      params.config ? JSON.stringify(params.config) : null,
      now,
      now,
    );

    return this.get(id)!;
  }

  /**
   * タスクを更新
   */
  update(id: string, params: UpdateTaskParams): ScheduledTask | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const cronExpression = params.cronExpression ?? existing.cronExpression;
    const enabled = params.enabled ?? existing.enabled;
    const nextRunAt = enabled
      ? this.calculateNextRunAt(cronExpression)
      : undefined;

    const stmt = this.db.prepare(`
      UPDATE scheduled_tasks SET
        name = ?,
        description = ?,
        cron_expression = ?,
        enabled = ?,
        next_run_at = ?,
        config = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      params.name ?? existing.name,
      params.description ?? existing.description ?? null,
      cronExpression,
      enabled ? 1 : 0,
      nextRunAt ?? null,
      params.config
        ? JSON.stringify(params.config)
        : existing.config
          ? JSON.stringify(existing.config)
          : null,
      now,
      id,
    );

    return this.get(id);
  }

  /**
   * タスクを削除
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM scheduled_tasks WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * タスクの有効/無効を切り替え
   */
  toggle(id: string, enabled: boolean): ScheduledTask | null {
    return this.update(id, { enabled });
  }

  /**
   * 最終実行時刻を更新
   */
  updateLastRunAt(id: string): ScheduledTask | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const nextRunAt = existing.enabled
      ? this.calculateNextRunAt(existing.cronExpression)
      : undefined;

    const stmt = this.db.prepare(`
      UPDATE scheduled_tasks SET
        last_run_at = ?,
        next_run_at = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(now, nextRunAt ?? null, now, id);

    return this.get(id);
  }

  /**
   * タスクタイプで検索
   */
  findByType(taskType: string): ScheduledTask | null {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_tasks WHERE task_type = ? LIMIT 1
    `);
    const row = stmt.get(taskType) as
      | {
          id: string;
          name: string;
          description: string | null;
          task_type: string;
          cron_expression: string;
          enabled: number;
          last_run_at: string | null;
          next_run_at: string | null;
          config: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      taskType: row.task_type,
      cronExpression: row.cron_expression,
      enabled: row.enabled === 1,
      lastRunAt: row.last_run_at ?? undefined,
      nextRunAt: row.next_run_at ?? undefined,
      config: row.config ? JSON.parse(row.config) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 有効なタスク一覧を取得
   */
  listEnabled(): ScheduledTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_tasks WHERE enabled = 1 ORDER BY created_at DESC
    `);
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      description: string | null;
      task_type: string;
      cron_expression: string;
      enabled: number;
      last_run_at: string | null;
      next_run_at: string | null;
      config: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      taskType: row.task_type,
      cronExpression: row.cron_expression,
      enabled: true,
      lastRunAt: row.last_run_at ?? undefined,
      nextRunAt: row.next_run_at ?? undefined,
      config: row.config ? JSON.parse(row.config) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * データベースを閉じる
   */
  close(): void {
    this.db.close();
  }
}
