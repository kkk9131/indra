import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { CronExpressionParser } from "cron-parser";

import type {
  ScheduledTask,
  CreateTaskParams,
  UpdateTaskParams,
} from "./types.js";

const DB_PATH = join(homedir(), ".indra", "sessions.db");

/**
 * スケジュールストア（SQLite CRUD）
 */
export class ScheduleStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? DB_PATH;
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initTable();
    this.migrateLegacySchedules();
    this.dedupeExactTasks();
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

  private migrateLegacySchedules(): void {
    const legacyPaths = [
      join(process.cwd(), "data", "sessions.db"),
      join(process.cwd(), "dist", "data", "sessions.db"),
    ];

    for (const legacyPath of legacyPaths) {
      if (legacyPath === this.dbPath) {
        continue;
      }
      if (!existsSync(legacyPath)) {
        continue;
      }

      try {
        const legacyDb = new Database(legacyPath, {
          readonly: true,
          fileMustExist: true,
        });

        const table = legacyDb
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'scheduled_tasks'",
          )
          .get();
        if (!table) {
          legacyDb.close();
          continue;
        }

        const rows = legacyDb
          .prepare("SELECT * FROM scheduled_tasks")
          .all() as Array<{
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

        if (rows.length === 0) {
          legacyDb.close();
          continue;
        }

        const insert = this.db.prepare(`
          INSERT OR IGNORE INTO scheduled_tasks (
            id, name, description, task_type, cron_expression,
            enabled, last_run_at, next_run_at, config, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let inserted = 0;
        const transaction = this.db.transaction(() => {
          for (const row of rows) {
            const result = insert.run(
              row.id,
              row.name,
              row.description ?? null,
              row.task_type,
              row.cron_expression,
              row.enabled,
              row.last_run_at ?? null,
              row.next_run_at ?? null,
              row.config ?? null,
              row.created_at,
              row.updated_at,
            );
            inserted += result.changes;
          }
        });

        transaction();
        legacyDb.close();

        if (inserted > 0) {
          console.log(
            `ScheduleStore: Migrated ${inserted} task(s) from ${legacyPath}`,
          );
        }
      } catch (error) {
        console.warn(
          "ScheduleStore: Failed to migrate legacy schedules:",
          error,
        );
      }
    }
  }

  private dedupeExactTasks(): void {
    const rows = this.db.prepare(
      `
        SELECT id, name, description, task_type, cron_expression, config, created_at, updated_at
        FROM scheduled_tasks
      `,
    ).all() as Array<{
      id: string;
      name: string;
      description: string | null;
      task_type: string;
      cron_expression: string;
      config: string | null;
      created_at: string;
      updated_at: string;
    }>;

    if (rows.length <= 1) {
      return;
    }

    const keyFor = (row: (typeof rows)[number]) =>
      [
        row.task_type,
        row.name,
        row.description ?? "",
        row.cron_expression,
        row.config ?? "",
      ].join("|");

    const keepByKey = new Map<
      string,
      { id: string; updatedAt: string; createdAt: string }
    >();
    const toDelete: string[] = [];

    for (const row of rows) {
      const key = keyFor(row);
      const existing = keepByKey.get(key);
      if (!existing) {
        keepByKey.set(key, {
          id: row.id,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
        });
        continue;
      }

      const existingStamp = existing.updatedAt || existing.createdAt;
      const rowStamp = row.updated_at || row.created_at;
      if (rowStamp > existingStamp) {
        toDelete.push(existing.id);
        keepByKey.set(key, {
          id: row.id,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
        });
      } else {
        toDelete.push(row.id);
      }
    }

    if (toDelete.length === 0) {
      return;
    }

    const stmt = this.db.prepare(
      "DELETE FROM scheduled_tasks WHERE id = ?",
    );
    const transaction = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(id);
      }
    });
    transaction(toDelete);

    console.log(`ScheduleStore: Deduped ${toDelete.length} task(s)`);
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
