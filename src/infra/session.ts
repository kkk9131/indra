import Database from "better-sqlite3";
import path from "path";
import { homedir } from "os";
import { z } from "zod";

export const SessionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["cli", "web"]),
  createdAt: z.number(),
  lastSeenAt: z.number(),
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
        lastSeenAt INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type)
    `);
  }

  create(type: "cli" | "web"): Session {
    const session = {
      id: crypto.randomUUID(),
      type,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, type, createdAt, lastSeenAt)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(session.id, session.type, session.createdAt, session.lastSeenAt);

    return session;
  }

  get(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, type, createdAt, lastSeenAt
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
    let sql = `SELECT id, type, createdAt, lastSeenAt FROM sessions`;
    const params: unknown[] = [];

    if (type) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as unknown[];

    return rows
      .map((row) => {
        const parsed = SessionSchema.safeParse(row);
        return parsed.success ? parsed.data : null;
      })
      .filter((s): s is Session => s !== null);
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
