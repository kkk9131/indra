import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";

import type { LogEntry } from "./types.js";
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
        message TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_sessionId ON logs(sessionId)
    `);
  }

  private parseRow(row: Record<string, unknown>): LogEntry | null {
    const parsed = LogEntrySchema.safeParse(row);
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
    ];
  }

  private getUpsertStatement(): Database.Statement {
    return this.db.prepare(`
      INSERT INTO logs (
        id, type, timestamp, sessionId, agentAction, tool, toolInput, toolResult,
        turnNumber, text, prompt, response, model, level, message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        message = excluded.message
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

  listByType(type: "agent" | "prompt" | "system"): LogEntry[] {
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
    type: "all" | "agent" | "prompt" | "system" = "all",
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

  deleteOlderThan(date: Date): number {
    return this.db
      .prepare(`DELETE FROM logs WHERE timestamp < ?`)
      .run(date.toISOString()).changes;
  }

  count(type: "all" | "agent" | "prompt" | "system" = "all"): number {
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
