import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";

import type { LogEntry, LogType } from "./types.js";
import { LogEntrySchema } from "./types.js";

export class LogStore {
  private db: Database.Database;

  constructor(dataDir?: string) {
    const dbPath = join(dataDir ?? join(homedir(), ".indra"), "sessions.db");
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sessionId TEXT,
        agentAction TEXT,
        tool TEXT,
        toolInput TEXT,
        toolResult TEXT,
        turnNumber INTEGER,
        text TEXT,
        prompt TEXT,
        response TEXT,
        model TEXT,
        level TEXT,
        message TEXT,
        executionId TEXT,
        executionAction TEXT,
        executionConfig TEXT,
        input TEXT,
        executionResult TEXT,
        executionError TEXT,
        outcomeId TEXT,
        outcomeType TEXT,
        outcomeStage TEXT,
        outcomeContent TEXT,
        previousOutcomeId TEXT,
        metadata TEXT
      )
    `);

    // Migration: add new columns to existing tables
    this.migrateAddColumns();

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_sessionId ON logs(sessionId)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_executionId ON logs(executionId)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_outcomeId ON logs(outcomeId)
    `);
  }

  private migrateAddColumns(): void {
    const columns = this.db.prepare("PRAGMA table_info(logs)").all() as Array<{
      name: string;
    }>;
    const existingColumns = new Set(columns.map((c) => c.name));

    const newColumns = [
      { name: "executionId", type: "TEXT" },
      { name: "executionAction", type: "TEXT" },
      { name: "executionConfig", type: "TEXT" },
      { name: "input", type: "TEXT" },
      { name: "executionResult", type: "TEXT" },
      { name: "executionError", type: "TEXT" },
      { name: "outcomeId", type: "TEXT" },
      { name: "outcomeType", type: "TEXT" },
      { name: "outcomeStage", type: "TEXT" },
      { name: "outcomeContent", type: "TEXT" },
      { name: "previousOutcomeId", type: "TEXT" },
      { name: "metadata", type: "TEXT" },
    ];

    for (const col of newColumns) {
      if (!existingColumns.has(col.name)) {
        this.db.exec(`ALTER TABLE logs ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  }

  private parseRow(row: Record<string, unknown>): LogEntry | null {
    // Parse JSON fields
    const transformedRow = {
      ...row,
      toolInput:
        typeof row.toolInput === "string"
          ? JSON.parse(row.toolInput)
          : row.toolInput,
      executionConfig:
        typeof row.executionConfig === "string"
          ? JSON.parse(row.executionConfig)
          : row.executionConfig,
      executionResult:
        typeof row.executionResult === "string"
          ? JSON.parse(row.executionResult)
          : row.executionResult,
      executionError:
        typeof row.executionError === "string"
          ? JSON.parse(row.executionError)
          : row.executionError,
      outcomeContent:
        typeof row.outcomeContent === "string"
          ? JSON.parse(row.outcomeContent)
          : row.outcomeContent,
      metadata:
        typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata,
    };
    const parsed = LogEntrySchema.safeParse(transformedRow);
    return parsed.success ? parsed.data : null;
  }

  private parseRows(rows: Array<Record<string, unknown>>): LogEntry[] {
    return rows
      .map((row) => this.parseRow(row))
      .filter((entry): entry is LogEntry => entry !== null);
  }

  private entryToParams(entry: LogEntry): unknown[] {
    return [
      entry.id,
      entry.type,
      entry.timestamp,
      entry.sessionId ?? null,
      entry.agentAction ?? null,
      entry.tool ?? null,
      entry.toolInput ? JSON.stringify(entry.toolInput) : null,
      entry.toolResult ?? null,
      entry.turnNumber ?? null,
      entry.text ?? null,
      entry.prompt ?? null,
      entry.response ?? null,
      entry.model ?? null,
      entry.level ?? null,
      entry.message ?? null,
      entry.executionId ?? null,
      entry.executionAction ?? null,
      entry.executionConfig ? JSON.stringify(entry.executionConfig) : null,
      entry.input ?? null,
      entry.executionResult ? JSON.stringify(entry.executionResult) : null,
      entry.executionError ? JSON.stringify(entry.executionError) : null,
      entry.outcomeId ?? null,
      entry.outcomeType ?? null,
      entry.outcomeStage ?? null,
      entry.outcomeContent ? JSON.stringify(entry.outcomeContent) : null,
      entry.previousOutcomeId ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ];
  }

  private getUpsertStatement(): Database.Statement {
    return this.db.prepare(`
      INSERT INTO logs (
        id, type, timestamp, sessionId, agentAction, tool, toolInput, toolResult,
        turnNumber, text, prompt, response, model, level, message,
        executionId, executionAction, executionConfig, input, executionResult, executionError,
        outcomeId, outcomeType, outcomeStage, outcomeContent, previousOutcomeId, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        timestamp = excluded.timestamp,
        sessionId = excluded.sessionId,
        agentAction = excluded.agentAction,
        tool = excluded.tool,
        toolInput = excluded.toolInput,
        toolResult = excluded.toolResult,
        turnNumber = excluded.turnNumber,
        text = excluded.text,
        prompt = excluded.prompt,
        response = excluded.response,
        model = excluded.model,
        level = excluded.level,
        message = excluded.message,
        executionId = excluded.executionId,
        executionAction = excluded.executionAction,
        executionConfig = excluded.executionConfig,
        input = excluded.input,
        executionResult = excluded.executionResult,
        executionError = excluded.executionError,
        outcomeId = excluded.outcomeId,
        outcomeType = excluded.outcomeType,
        outcomeStage = excluded.outcomeStage,
        outcomeContent = excluded.outcomeContent,
        previousOutcomeId = excluded.previousOutcomeId,
        metadata = excluded.metadata
    `);
  }

  save(entry: LogEntry): void {
    this.getUpsertStatement().run(...this.entryToParams(entry));
  }

  saveMultiple(entries: LogEntry[]): void {
    const upsert = this.getUpsertStatement();
    const transaction = this.db.transaction(() => {
      for (const entry of entries) {
        upsert.run(...this.entryToParams(entry));
      }
    });
    transaction();
  }

  list(): LogEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM logs ORDER BY timestamp DESC`)
      .all() as Array<Record<string, unknown>>;
    return this.parseRows(rows);
  }

  listByType(type: "all" | LogType): LogEntry[] {
    if (type === "all") {
      return this.list();
    }
    const rows = this.db
      .prepare(`SELECT * FROM logs WHERE type = ? ORDER BY timestamp DESC`)
      .all(type) as Array<Record<string, unknown>>;
    return this.parseRows(rows);
  }

  listBySessionId(sessionId: string): LogEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM logs WHERE sessionId = ? ORDER BY timestamp ASC`)
      .all(sessionId) as Array<Record<string, unknown>>;
    return this.parseRows(rows);
  }

  getById(id: string): LogEntry | null {
    const row = this.db.prepare(`SELECT * FROM logs WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.parseRow(row) : null;
  }

  listPaginated(
    type: "all" | LogType = "all",
    limit: number,
    offset = 0,
  ): LogEntry[] {
    const hasTypeFilter = type !== "all";
    const sql = hasTypeFilter
      ? `SELECT * FROM logs WHERE type = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
      : `SELECT * FROM logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`;

    const params = hasTypeFilter ? [type, limit, offset] : [limit, offset];
    const rows = this.db.prepare(sql).all(...params) as Array<
      Record<string, unknown>
    >;
    return this.parseRows(rows);
  }

  listSince(since: Date): LogEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM logs WHERE timestamp >= ? ORDER BY timestamp ASC`)
      .all(since.toISOString()) as Array<Record<string, unknown>>;
    return this.parseRows(rows);
  }

  deleteOlderThan(date: Date): number {
    return this.db
      .prepare(`DELETE FROM logs WHERE timestamp < ?`)
      .run(date.toISOString()).changes;
  }

  count(type: "all" | LogType = "all"): number {
    let sql = `SELECT COUNT(*) as count FROM logs`;
    if (type !== "all") {
      sql += ` WHERE type = ?`;
    }
    const row = this.db.prepare(sql).get(type === "all" ? undefined : type) as {
      count: number;
    };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}
