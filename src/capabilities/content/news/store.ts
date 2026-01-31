import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";

import type { NewsArticle } from "./types.js";
import { NewsArticleSchema } from "./types.js";

const MIGRATION_COLUMNS = ["body", "imageUrl", "titleJa", "bodyJa"] as const;

export class NewsStore {
  private db: Database.Database;

  constructor(dataDir?: string) {
    const dbPath = join(dataDir ?? join(homedir(), ".indra"), "sessions.db");
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        titleJa TEXT,
        summary TEXT,
        url TEXT NOT NULL,
        publishedAt TEXT,
        fetchedAt TEXT NOT NULL,
        contentHash TEXT,
        body TEXT,
        bodyJa TEXT,
        imageUrl TEXT
      )
    `);

    for (const column of MIGRATION_COLUMNS) {
      this.addColumnIfNotExists(column, "TEXT");
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_news_fetchedAt ON news_articles(fetchedAt DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_news_contentHash ON news_articles(contentHash)
    `);

    this.migrateSource("log-analysis", "indra-log");
  }

  private migrateSource(oldSource: string, newSource: string): void {
    const result = this.db
      .prepare(`UPDATE news_articles SET source = ? WHERE source = ?`)
      .run(newSource, oldSource);
    if (result.changes > 0) {
      console.log(
        `NewsStore: Migrated ${result.changes} articles from ${oldSource} to ${newSource}`,
      );
    }
  }

  private addColumnIfNotExists(columnName: string, columnType: string): void {
    try {
      this.db.exec(
        `ALTER TABLE news_articles ADD COLUMN ${columnName} ${columnType}`,
      );
    } catch {
      // カラムが既に存在する場合は無視
    }
  }

  private rowToArticle(row: Record<string, unknown>): NewsArticle | null {
    const parsed = NewsArticleSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
  }

  private rowsToArticles(rows: Array<Record<string, unknown>>): NewsArticle[] {
    return rows
      .map((row) => this.rowToArticle(row))
      .filter((article): article is NewsArticle => article !== null);
  }

  save(articles: NewsArticle[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO news_articles (id, source, title, titleJa, summary, url, publishedAt, fetchedAt, contentHash, body, bodyJa, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        title = excluded.title,
        titleJa = excluded.titleJa,
        summary = excluded.summary,
        url = excluded.url,
        publishedAt = excluded.publishedAt,
        fetchedAt = excluded.fetchedAt,
        contentHash = excluded.contentHash,
        body = excluded.body,
        bodyJa = excluded.bodyJa,
        imageUrl = excluded.imageUrl
    `);

    const transaction = this.db.transaction(() => {
      for (const article of articles) {
        upsert.run(
          article.id,
          article.source,
          article.title,
          article.titleJa ?? null,
          article.summary,
          article.url,
          article.publishedAt,
          article.fetchedAt,
          article.contentHash ?? null,
          article.body ?? null,
          article.bodyJa ?? null,
          article.imageUrl ?? null,
        );
      }
    });

    transaction();
  }

  list(): NewsArticle[] {
    const rows = this.db
      .prepare(`SELECT * FROM news_articles ORDER BY fetchedAt DESC`)
      .all() as Array<Record<string, unknown>>;
    return this.rowsToArticles(rows);
  }

  getById(id: string): NewsArticle | null {
    const row = this.db
      .prepare(`SELECT * FROM news_articles WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToArticle(row) : null;
  }

  hasHash(hash: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 FROM news_articles WHERE contentHash = ? LIMIT 1`)
      .get(hash);
    return row !== undefined;
  }

  listBySource(source: string): NewsArticle[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM news_articles WHERE source = ? ORDER BY fetchedAt DESC`,
      )
      .all(source) as Array<Record<string, unknown>>;
    return this.rowsToArticles(rows);
  }

  listPaginated(limit: number, offset = 0): NewsArticle[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM news_articles ORDER BY fetchedAt DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Array<Record<string, unknown>>;
    return this.rowsToArticles(rows);
  }

  deleteOlderThan(date: Date): number {
    return this.db
      .prepare(`DELETE FROM news_articles WHERE fetchedAt < ?`)
      .run(date.toISOString()).changes;
  }

  count(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM news_articles`)
      .get() as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}
