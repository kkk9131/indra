import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import type { NewsSourceDefinition, NewsSourceType } from "./types.js";

export interface CreateNewsSourceParams {
  name: string;
  sourceType: NewsSourceType;
  sourceConfig: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateNewsSourceParams {
  name?: string;
  sourceConfig?: Record<string, unknown>;
  enabled?: boolean;
}

interface NewsSourceRow {
  id: string;
  name: string;
  source_type: string;
  source_config: string;
  enabled: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export class NewsSourceStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath ?? join(homedir(), ".indra", "sessions.db");
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS news_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_config TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_fetched_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  private rowToSource(row: NewsSourceRow): NewsSourceDefinition {
    return {
      id: row.id,
      name: row.name,
      sourceType: row.source_type as NewsSourceType,
      sourceConfig: JSON.parse(row.source_config),
      enabled: row.enabled === 1,
      lastFetchedAt: row.last_fetched_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  list(): NewsSourceDefinition[] {
    const stmt = this.db.prepare(
      "SELECT * FROM news_sources ORDER BY created_at DESC",
    );
    const rows = stmt.all() as NewsSourceRow[];
    return rows.map((row) => this.rowToSource(row));
  }

  get(id: string): NewsSourceDefinition | null {
    const stmt = this.db.prepare("SELECT * FROM news_sources WHERE id = ?");
    const row = stmt.get(id) as NewsSourceRow | undefined;
    if (!row) return null;
    return this.rowToSource(row);
  }

  create(params: CreateNewsSourceParams): NewsSourceDefinition {
    const id = randomUUID();
    const now = new Date().toISOString();
    const enabled = params.enabled !== false ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO news_sources (
        id, name, source_type, source_config, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.name,
      params.sourceType,
      JSON.stringify(params.sourceConfig),
      enabled,
      now,
      now,
    );

    return this.get(id)!;
  }

  update(
    id: string,
    params: UpdateNewsSourceParams,
  ): NewsSourceDefinition | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = params.name ?? existing.name;
    const sourceConfig = params.sourceConfig ?? existing.sourceConfig;
    const enabled = this.resolveEnabled(params.enabled, existing.enabled);

    const stmt = this.db.prepare(`
      UPDATE news_sources SET
        name = ?, source_config = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(name, JSON.stringify(sourceConfig), enabled, now, id);
    return this.get(id);
  }

  private resolveEnabled(
    newValue: boolean | undefined,
    currentValue: boolean,
  ): number {
    if (newValue === undefined) {
      return currentValue ? 1 : 0;
    }
    return newValue ? 1 : 0;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM news_sources WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  toggle(id: string, enabled: boolean): NewsSourceDefinition | null {
    return this.update(id, { enabled });
  }

  listEnabled(): NewsSourceDefinition[] {
    const stmt = this.db.prepare(
      "SELECT * FROM news_sources WHERE enabled = 1 ORDER BY created_at DESC",
    );
    const rows = stmt.all() as NewsSourceRow[];
    return rows.map((row) => this.rowToSource(row));
  }

  listByType(sourceType: NewsSourceType): NewsSourceDefinition[] {
    const stmt = this.db.prepare(
      "SELECT * FROM news_sources WHERE source_type = ? ORDER BY created_at DESC",
    );
    const rows = stmt.all(sourceType) as NewsSourceRow[];
    return rows.map((row) => this.rowToSource(row));
  }

  updateLastFetchedAt(id: string): NewsSourceDefinition | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE news_sources SET last_fetched_at = ?, updated_at = ? WHERE id = ?
    `);

    stmt.run(now, now, id);
    return this.get(id);
  }

  close(): void {
    this.db.close();
  }
}
