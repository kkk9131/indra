import Database from "better-sqlite3";
import path from "path";
import { homedir } from "os";
import { ConfigSchema, createDefaultConfig, type Config } from "./schema.js";

export class ConfigManager {
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
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);
  }

  get(): Config {
    const stmt = this.db.prepare(`SELECT key, value FROM config`);
    const rows = stmt.all() as Array<{ key: string; value: string }>;

    if (rows.length === 0) {
      return createDefaultConfig();
    }

    const configData: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        configData[row.key] = JSON.parse(row.value);
      } catch {
        configData[row.key] = row.value;
      }
    }

    const parsed = ConfigSchema.safeParse(configData);
    return parsed.success ? parsed.data : createDefaultConfig();
  }

  set(config: Partial<Config>): void {
    const current = this.get();
    const merged = { ...current, ...config };

    const now = Date.now();
    const upsert = this.db.prepare(`
      INSERT INTO config (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updatedAt = excluded.updatedAt
    `);

    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(merged)) {
        upsert.run(key, JSON.stringify(value), now);
      }
    });

    transaction();
  }

  setKey<K extends keyof Config>(key: K, value: Config[K]): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO config (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updatedAt = excluded.updatedAt
    `);
    stmt.run(key, JSON.stringify(value), now);
  }

  getKey<K extends keyof Config>(key: K): Config[K] {
    const stmt = this.db.prepare(`SELECT value FROM config WHERE key = ?`);
    const row = stmt.get(key) as { value: string } | undefined;

    if (!row) {
      const defaultConfig = createDefaultConfig();
      return defaultConfig[key];
    }

    try {
      return JSON.parse(row.value) as Config[K];
    } catch {
      const defaultConfig = createDefaultConfig();
      return defaultConfig[key];
    }
  }

  reset(): void {
    this.db.exec(`DELETE FROM config`);
  }

  close(): void {
    this.db.close();
  }
}
