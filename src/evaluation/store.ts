import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import type {
  Task,
  Trial,
  GraderResult,
  CreateTaskInput,
  CreateTrialInput,
  RecordGraderResultInput,
  TrialWithResults,
} from "./types.js";
import { TaskSchema, TrialSchema, GraderResultSchema } from "./types.js";

export class EvaluationStore {
  private db: Database.Database;

  constructor(dataDir?: string) {
    const dbPath = join(dataDir ?? join(homedir(), ".indra"), "sessions.db");
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eval_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        taskType TEXT NOT NULL,
        input TEXT NOT NULL,
        successCriteria TEXT NOT NULL,
        shouldFail INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Trials table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eval_trials (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        trialNumber INTEGER NOT NULL,
        executionId TEXT,
        sessionId TEXT,
        outcomeId TEXT,
        passed INTEGER NOT NULL DEFAULT 0,
        duration INTEGER,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (taskId) REFERENCES eval_tasks(id) ON DELETE CASCADE
      )
    `);

    // Grader results table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eval_grader_results (
        id TEXT PRIMARY KEY,
        trialId TEXT NOT NULL,
        graderType TEXT NOT NULL,
        graderName TEXT NOT NULL,
        passed INTEGER NOT NULL DEFAULT 0,
        score REAL NOT NULL,
        reason TEXT NOT NULL,
        details TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (trialId) REFERENCES eval_trials(id) ON DELETE CASCADE
      )
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_eval_trials_taskId ON eval_trials(taskId)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_eval_trials_executionId ON eval_trials(executionId)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_eval_grader_results_trialId ON eval_grader_results(trialId)
    `);
  }

  // ===== Task CRUD =====

  createTask(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      name: input.name,
      taskType: input.taskType,
      input: input.input,
      successCriteria: input.successCriteria,
      shouldFail: input.shouldFail ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO eval_tasks (id, name, taskType, input, successCriteria, shouldFail, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.name,
        task.taskType,
        task.input,
        task.successCriteria,
        task.shouldFail ? 1 : 0,
        task.createdAt,
        task.updatedAt,
      );

    return task;
  }

  getTask(id: string): Task | null {
    const row = this.db
      .prepare(`SELECT * FROM eval_tasks WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.parseTaskRow(row) : null;
  }

  listTasks(): Task[] {
    const rows = this.db
      .prepare(`SELECT * FROM eval_tasks ORDER BY createdAt DESC`)
      .all() as Array<Record<string, unknown>>;

    return rows
      .map((row) => this.parseTaskRow(row))
      .filter((t): t is Task => t !== null);
  }

  listTasksByType(taskType: string): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM eval_tasks WHERE taskType = ? ORDER BY createdAt DESC`,
      )
      .all(taskType) as Array<Record<string, unknown>>;

    return rows
      .map((row) => this.parseTaskRow(row))
      .filter((t): t is Task => t !== null);
  }

  updateTask(id: string, updates: Partial<CreateTaskInput>): Task | null {
    const task = this.getTask(id);
    if (!task) return null;

    const updated: Task = {
      ...task,
      name: updates.name ?? task.name,
      taskType: updates.taskType ?? task.taskType,
      input: updates.input ?? task.input,
      successCriteria: updates.successCriteria ?? task.successCriteria,
      shouldFail: updates.shouldFail ?? task.shouldFail,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `UPDATE eval_tasks
         SET name = ?, taskType = ?, input = ?, successCriteria = ?, shouldFail = ?, updatedAt = ?
         WHERE id = ?`,
      )
      .run(
        updated.name,
        updated.taskType,
        updated.input,
        updated.successCriteria,
        updated.shouldFail ? 1 : 0,
        updated.updatedAt,
        id,
      );

    return updated;
  }

  deleteTask(id: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM eval_tasks WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }

  private parseTaskRow(row: Record<string, unknown>): Task | null {
    const transformed = {
      ...row,
      shouldFail: row.shouldFail === 1,
    };
    const parsed = TaskSchema.safeParse(transformed);
    return parsed.success ? parsed.data : null;
  }

  // ===== Trial CRUD =====

  createTrial(input: CreateTrialInput): Trial {
    const taskTrials = this.listTrialsByTask(input.taskId);
    const trialNumber = taskTrials.length + 1;

    const trial: Trial = {
      id: randomUUID(),
      taskId: input.taskId,
      trialNumber,
      executionId: input.executionId ?? null,
      sessionId: input.sessionId ?? null,
      outcomeId: input.outcomeId ?? null,
      passed: false,
      duration: null,
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO eval_trials (id, taskId, trialNumber, executionId, sessionId, outcomeId, passed, duration, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trial.id,
        trial.taskId,
        trial.trialNumber,
        trial.executionId,
        trial.sessionId,
        trial.outcomeId,
        trial.passed ? 1 : 0,
        trial.duration,
        trial.createdAt,
      );

    return trial;
  }

  getTrial(id: string): Trial | null {
    const row = this.db
      .prepare(`SELECT * FROM eval_trials WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.parseTrialRow(row) : null;
  }

  listTrialsByTask(taskId: string): Trial[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM eval_trials WHERE taskId = ? ORDER BY trialNumber ASC`,
      )
      .all(taskId) as Array<Record<string, unknown>>;

    return rows
      .map((row) => this.parseTrialRow(row))
      .filter((t): t is Trial => t !== null);
  }

  getTrialByExecutionId(executionId: string): Trial | null {
    const row = this.db
      .prepare(`SELECT * FROM eval_trials WHERE executionId = ?`)
      .get(executionId) as Record<string, unknown> | undefined;

    return row ? this.parseTrialRow(row) : null;
  }

  updateTrialResult(
    id: string,
    passed: boolean,
    duration?: number,
  ): Trial | null {
    const trial = this.getTrial(id);
    if (!trial) return null;

    this.db
      .prepare(`UPDATE eval_trials SET passed = ?, duration = ? WHERE id = ?`)
      .run(passed ? 1 : 0, duration ?? null, id);

    return { ...trial, passed, duration: duration ?? trial.duration };
  }

  deleteTrial(id: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM eval_trials WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }

  private parseTrialRow(row: Record<string, unknown>): Trial | null {
    const transformed = {
      ...row,
      passed: row.passed === 1,
    };
    const parsed = TrialSchema.safeParse(transformed);
    return parsed.success ? parsed.data : null;
  }

  // ===== Grader Result CRUD =====

  recordGraderResult(input: RecordGraderResultInput): GraderResult {
    const result: GraderResult = {
      id: randomUUID(),
      trialId: input.trialId,
      graderType: input.graderType,
      graderName: input.graderName,
      passed: input.passed,
      score: input.score,
      reason: input.reason,
      details: input.details ?? null,
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO eval_grader_results (id, trialId, graderType, graderName, passed, score, reason, details, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        result.id,
        result.trialId,
        result.graderType,
        result.graderName,
        result.passed ? 1 : 0,
        result.score,
        result.reason,
        result.details ? JSON.stringify(result.details) : null,
        result.createdAt,
      );

    return result;
  }

  getGraderResult(id: string): GraderResult | null {
    const row = this.db
      .prepare(`SELECT * FROM eval_grader_results WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.parseGraderResultRow(row) : null;
  }

  listGraderResultsByTrial(trialId: string): GraderResult[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM eval_grader_results WHERE trialId = ? ORDER BY createdAt ASC`,
      )
      .all(trialId) as Array<Record<string, unknown>>;

    return rows
      .map((row) => this.parseGraderResultRow(row))
      .filter((r): r is GraderResult => r !== null);
  }

  private parseGraderResultRow(
    row: Record<string, unknown>,
  ): GraderResult | null {
    const transformed = {
      ...row,
      passed: row.passed === 1,
      details:
        typeof row.details === "string" ? JSON.parse(row.details) : row.details,
    };
    const parsed = GraderResultSchema.safeParse(transformed);
    return parsed.success ? parsed.data : null;
  }

  // ===== Aggregation Queries =====

  getTrialWithResults(trialId: string): TrialWithResults | null {
    const trial = this.getTrial(trialId);
    if (!trial) return null;

    const graderResults = this.listGraderResultsByTrial(trialId);
    return { ...trial, graderResults };
  }

  getTaskTrialStats(taskId: string): { total: number; passed: number } {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as total, SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed
         FROM eval_trials WHERE taskId = ?`,
      )
      .get(taskId) as { total: number; passed: number };

    return { total: row.total, passed: row.passed ?? 0 };
  }

  getAverageScore(taskId: string): number {
    const row = this.db
      .prepare(
        `SELECT AVG(gr.score) as avgScore
         FROM eval_grader_results gr
         JOIN eval_trials t ON gr.trialId = t.id
         WHERE t.taskId = ?`,
      )
      .get(taskId) as { avgScore: number | null };

    return row.avgScore ?? 0;
  }

  getAverageDuration(taskId: string): number | null {
    const row = this.db
      .prepare(
        `SELECT AVG(duration) as avgDuration
         FROM eval_trials WHERE taskId = ? AND duration IS NOT NULL`,
      )
      .get(taskId) as { avgDuration: number | null };

    return row.avgDuration;
  }

  close(): void {
    this.db.close();
  }
}
