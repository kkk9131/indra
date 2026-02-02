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
      // api log columns
      { name: "apiService", type: "TEXT" },
      { name: "apiEndpoint", type: "TEXT" },
      { name: "apiMethod", type: "TEXT" },
      { name: "apiRequestData", type: "TEXT" },
      { name: "apiResponseStatus", type: "INTEGER" },
      { name: "apiResponseData", type: "TEXT" },
      { name: "apiDuration", type: "INTEGER" },
      { name: "apiError", type: "TEXT" },
      // approval log columns
      { name: "approvalId", type: "TEXT" },
      { name: "approvalAction", type: "TEXT" },
      { name: "approvalPlatform", type: "TEXT" },
      { name: "approvalContent", type: "TEXT" },
      { name: "approvalBy", type: "TEXT" },
      { name: "approvalReason", type: "TEXT" },
      // scheduler log columns
      { name: "schedulerTaskId", type: "TEXT" },
      { name: "schedulerTaskType", type: "TEXT" },
      { name: "schedulerTaskName", type: "TEXT" },
      { name: "schedulerAction", type: "TEXT" },
      { name: "schedulerCronExpression", type: "TEXT" },
      { name: "schedulerDuration", type: "INTEGER" },
      { name: "schedulerNextRunAt", type: "TEXT" },
      { name: "schedulerError", type: "TEXT" },
      // browser log columns
      { name: "browserAction", type: "TEXT" },
      { name: "browserSession", type: "TEXT" },
      { name: "browserUrl", type: "TEXT" },
      { name: "browserSelector", type: "TEXT" },
      { name: "browserInput", type: "TEXT" },
      { name: "browserDuration", type: "INTEGER" },
      { name: "browserError", type: "TEXT" },
      // auth log columns
      { name: "authAction", type: "TEXT" },
      { name: "authProvider", type: "TEXT" },
      { name: "authUserId", type: "TEXT" },
      { name: "authScopes", type: "TEXT" },
      { name: "authExpiresAt", type: "TEXT" },
      { name: "authError", type: "TEXT" },
      // memory log columns
      { name: "memoryAction", type: "TEXT" },
      { name: "memoryFilePath", type: "TEXT" },
      { name: "memoryChunkCount", type: "INTEGER" },
      { name: "memoryTokenCount", type: "INTEGER" },
      { name: "memoryQuery", type: "TEXT" },
      { name: "memoryResultCount", type: "INTEGER" },
      { name: "memoryDuration", type: "INTEGER" },
      // user log columns
      { name: "userAction", type: "TEXT" },
      { name: "userChannel", type: "TEXT" },
      { name: "userInput", type: "TEXT" },
      { name: "userCommand", type: "TEXT" },
      { name: "userResponse", type: "TEXT" },
    ];

    for (const col of newColumns) {
      if (!existingColumns.has(col.name)) {
        this.db.exec(`ALTER TABLE logs ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  }

  private parseJsonField(value: unknown): unknown {
    return typeof value === "string" ? JSON.parse(value) : value;
  }

  private parseRow(row: Record<string, unknown>): LogEntry | null {
    const jsonFields = [
      "toolInput",
      "executionConfig",
      "executionResult",
      "executionError",
      "outcomeContent",
      "metadata",
      "apiRequestData",
      "apiResponseData",
      "apiError",
      "approvalContent",
      "schedulerError",
      "browserError",
      "authScopes",
      "authError",
    ];

    const transformedRow = { ...row };
    for (const field of jsonFields) {
      if (row[field] !== undefined) {
        transformedRow[field] = this.parseJsonField(row[field]);
      }
    }

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
      // api log
      entry.apiService ?? null,
      entry.apiEndpoint ?? null,
      entry.apiMethod ?? null,
      entry.apiRequestData ? JSON.stringify(entry.apiRequestData) : null,
      entry.apiResponseStatus ?? null,
      entry.apiResponseData ? JSON.stringify(entry.apiResponseData) : null,
      entry.apiDuration ?? null,
      entry.apiError ? JSON.stringify(entry.apiError) : null,
      // approval log
      entry.approvalId ?? null,
      entry.approvalAction ?? null,
      entry.approvalPlatform ?? null,
      entry.approvalContent ? JSON.stringify(entry.approvalContent) : null,
      entry.approvalBy ?? null,
      entry.approvalReason ?? null,
      // scheduler log
      entry.schedulerTaskId ?? null,
      entry.schedulerTaskType ?? null,
      entry.schedulerTaskName ?? null,
      entry.schedulerAction ?? null,
      entry.schedulerCronExpression ?? null,
      entry.schedulerDuration ?? null,
      entry.schedulerNextRunAt ?? null,
      entry.schedulerError ? JSON.stringify(entry.schedulerError) : null,
      // browser log
      entry.browserAction ?? null,
      entry.browserSession ?? null,
      entry.browserUrl ?? null,
      entry.browserSelector ?? null,
      entry.browserInput ?? null,
      entry.browserDuration ?? null,
      entry.browserError ? JSON.stringify(entry.browserError) : null,
      // auth log
      entry.authAction ?? null,
      entry.authProvider ?? null,
      entry.authUserId ?? null,
      entry.authScopes ? JSON.stringify(entry.authScopes) : null,
      entry.authExpiresAt ?? null,
      entry.authError ? JSON.stringify(entry.authError) : null,
      // memory log
      entry.memoryAction ?? null,
      entry.memoryFilePath ?? null,
      entry.memoryChunkCount ?? null,
      entry.memoryTokenCount ?? null,
      entry.memoryQuery ?? null,
      entry.memoryResultCount ?? null,
      entry.memoryDuration ?? null,
      // user log
      entry.userAction ?? null,
      entry.userChannel ?? null,
      entry.userInput ?? null,
      entry.userCommand ?? null,
      entry.userResponse ?? null,
    ];
  }

  private getUpsertStatement(): Database.Statement {
    return this.db.prepare(`
      INSERT INTO logs (
        id, type, timestamp, sessionId, agentAction, tool, toolInput, toolResult,
        turnNumber, text, prompt, response, model, level, message,
        executionId, executionAction, executionConfig, input, executionResult, executionError,
        outcomeId, outcomeType, outcomeStage, outcomeContent, previousOutcomeId, metadata,
        apiService, apiEndpoint, apiMethod, apiRequestData, apiResponseStatus, apiResponseData, apiDuration, apiError,
        approvalId, approvalAction, approvalPlatform, approvalContent, approvalBy, approvalReason,
        schedulerTaskId, schedulerTaskType, schedulerTaskName, schedulerAction, schedulerCronExpression, schedulerDuration, schedulerNextRunAt, schedulerError,
        browserAction, browserSession, browserUrl, browserSelector, browserInput, browserDuration, browserError,
        authAction, authProvider, authUserId, authScopes, authExpiresAt, authError,
        memoryAction, memoryFilePath, memoryChunkCount, memoryTokenCount, memoryQuery, memoryResultCount, memoryDuration,
        userAction, userChannel, userInput, userCommand, userResponse
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        metadata = excluded.metadata,
        apiService = excluded.apiService,
        apiEndpoint = excluded.apiEndpoint,
        apiMethod = excluded.apiMethod,
        apiRequestData = excluded.apiRequestData,
        apiResponseStatus = excluded.apiResponseStatus,
        apiResponseData = excluded.apiResponseData,
        apiDuration = excluded.apiDuration,
        apiError = excluded.apiError,
        approvalId = excluded.approvalId,
        approvalAction = excluded.approvalAction,
        approvalPlatform = excluded.approvalPlatform,
        approvalContent = excluded.approvalContent,
        approvalBy = excluded.approvalBy,
        approvalReason = excluded.approvalReason,
        schedulerTaskId = excluded.schedulerTaskId,
        schedulerTaskType = excluded.schedulerTaskType,
        schedulerTaskName = excluded.schedulerTaskName,
        schedulerAction = excluded.schedulerAction,
        schedulerCronExpression = excluded.schedulerCronExpression,
        schedulerDuration = excluded.schedulerDuration,
        schedulerNextRunAt = excluded.schedulerNextRunAt,
        schedulerError = excluded.schedulerError,
        browserAction = excluded.browserAction,
        browserSession = excluded.browserSession,
        browserUrl = excluded.browserUrl,
        browserSelector = excluded.browserSelector,
        browserInput = excluded.browserInput,
        browserDuration = excluded.browserDuration,
        browserError = excluded.browserError,
        authAction = excluded.authAction,
        authProvider = excluded.authProvider,
        authUserId = excluded.authUserId,
        authScopes = excluded.authScopes,
        authExpiresAt = excluded.authExpiresAt,
        authError = excluded.authError,
        memoryAction = excluded.memoryAction,
        memoryFilePath = excluded.memoryFilePath,
        memoryChunkCount = excluded.memoryChunkCount,
        memoryTokenCount = excluded.memoryTokenCount,
        memoryQuery = excluded.memoryQuery,
        memoryResultCount = excluded.memoryResultCount,
        memoryDuration = excluded.memoryDuration,
        userAction = excluded.userAction,
        userChannel = excluded.userChannel,
        userInput = excluded.userInput,
        userCommand = excluded.userCommand,
        userResponse = excluded.userResponse
    `);
  }

  save(entry: LogEntry): void {
    try {
      this.getUpsertStatement().run(...this.entryToParams(entry));
    } catch (error) {
      console.error("[LogStore] Save error:", {
        error,
        entryType: entry.type,
        entryId: entry.id,
        tool: entry.tool,
        toolResultLength: entry.toolResult?.length,
      });
      throw error;
    }
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
