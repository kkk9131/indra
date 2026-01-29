import Database from "better-sqlite3";
import path from "path";
import { homedir } from "os";
import { z } from "zod";

export const SessionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["cli", "web"]),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  transcriptFile: z.string().nullable().optional(),
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  totalTokens: z.number().default(0),
  title: z.string().nullable().optional(),
});

export type Session = z.infer<typeof SessionSchema>;

export class SessionManager {
  private db: Database.Database;

  constructor(dataDir?: string) {
    const dbPath = path.join(
      dataDir ?? path.join(homedir(), ".indra"),
      "sessions.db",
    );
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('cli', 'web')),
        createdAt INTEGER NOT NULL,
        lastSeenAt INTEGER NOT NULL,
        transcriptFile TEXT,
        inputTokens INTEGER DEFAULT 0,
        outputTokens INTEGER DEFAULT 0,
        totalTokens INTEGER DEFAULT 0,
        title TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type)
    `);

    // Migration: add new columns if they don't exist
    this.migrateSchema();
  }

  private migrateSchema(): void {
    const columns = this.db
      .prepare("PRAGMA table_info(sessions)")
      .all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("transcriptFile")) {
      this.db.exec("ALTER TABLE sessions ADD COLUMN transcriptFile TEXT");
    }
    if (!columnNames.has("inputTokens")) {
      this.db.exec(
        "ALTER TABLE sessions ADD COLUMN inputTokens INTEGER DEFAULT 0",
      );
    }
    if (!columnNames.has("outputTokens")) {
      this.db.exec(
        "ALTER TABLE sessions ADD COLUMN outputTokens INTEGER DEFAULT 0",
      );
    }
    if (!columnNames.has("totalTokens")) {
      this.db.exec(
        "ALTER TABLE sessions ADD COLUMN totalTokens INTEGER DEFAULT 0",
      );
    }
    if (!columnNames.has("title")) {
      this.db.exec("ALTER TABLE sessions ADD COLUMN title TEXT");
    }
  }

  create(
    type: "cli" | "web",
    options?: { transcriptFile?: string; title?: string },
  ): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      type,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      transcriptFile: options?.transcriptFile ?? null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      title: options?.title ?? null,
    };

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, type, createdAt, lastSeenAt, transcriptFile, inputTokens, outputTokens, totalTokens, title)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.type,
      session.createdAt,
      session.lastSeenAt,
      session.transcriptFile,
      session.inputTokens,
      session.outputTokens,
      session.totalTokens,
      session.title,
    );

    return session;
  }

  get(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, type, createdAt, lastSeenAt, transcriptFile, inputTokens, outputTokens, totalTokens, title
      FROM sessions
      WHERE id = ?
    `);

    const row = stmt.get(id) as unknown;
    if (!row) return null;

    const parsed = SessionSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
  }

  updateLastSeen(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET lastSeenAt = ?
      WHERE id = ?
    `);

    stmt.run(Date.now(), id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM sessions WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  list(type?: "cli" | "web"): Session[] {
    let sql = `SELECT id, type, createdAt, lastSeenAt, transcriptFile, inputTokens, outputTokens, totalTokens, title FROM sessions`;
    const params: unknown[] = [];

    if (type) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY lastSeenAt DESC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as unknown[];

    return rows
      .map((row) => {
        const parsed = SessionSchema.safeParse(row);
        return parsed.success ? parsed.data : null;
      })
      .filter((s): s is Session => s !== null);
  }

  updateTranscriptFile(id: string, transcriptFile: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET transcriptFile = ?
      WHERE id = ?
    `);
    stmt.run(transcriptFile, id);
  }

  updateTokenUsage(
    id: string,
    usage: { input: number; output: number; total: number },
  ): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET inputTokens = inputTokens + ?,
          outputTokens = outputTokens + ?,
          totalTokens = totalTokens + ?
      WHERE id = ?
    `);
    stmt.run(usage.input, usage.output, usage.total, id);
  }

  updateTitle(id: string, title: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET title = ?
      WHERE id = ?
    `);
    stmt.run(title, id);
  }

  cleanup(olderThan: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM sessions
      WHERE lastSeenAt < ?
    `);

    const result = stmt.run(olderThan);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
