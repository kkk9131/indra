import Database from "better-sqlite3";
import { join } from "node:path";
import { createHash } from "node:crypto";

import type {
  MemoryChunk,
  MemoryStoreStats,
  SearchResult,
  SearchOptions,
} from "./types.js";
import { MemoryChunkSchema, getMemoryBasePath } from "./types.js";

export class MemoryStore {
  private db: Database.Database;
  private vectorEnabled = false;
  private vectorDimensions = 1536;

  constructor(dataDir?: string) {
    const dbPath = join(dataDir ?? getMemoryBasePath(), "sessions.db");
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL UNIQUE,
        start_line INTEGER,
        end_line INTEGER,
        token_count INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_chunks_file_path ON memory_chunks(file_path);
      CREATE INDEX IF NOT EXISTS idx_memory_chunks_content_hash ON memory_chunks(content_hash);
      CREATE INDEX IF NOT EXISTS idx_memory_chunks_updated_at ON memory_chunks(updated_at DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        content,
        content='memory_chunks',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS memory_chunks_ai AFTER INSERT ON memory_chunks BEGIN
        INSERT INTO memory_fts(rowid, content) VALUES (new.rowid, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_chunks_ad AFTER DELETE ON memory_chunks BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_chunks_au AFTER UPDATE ON memory_chunks BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content) VALUES('delete', old.rowid, old.content);
        INSERT INTO memory_fts(rowid, content) VALUES (new.rowid, new.content);
      END;

      CREATE TABLE IF NOT EXISTS embedding_cache (
        content_hash TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    this.initVectorTable();
  }

  private initVectorTable(): void {
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(
          chunk_id TEXT PRIMARY KEY,
          embedding float[${this.vectorDimensions}]
        )
      `);
      this.vectorEnabled = true;
    } catch {
      console.log(
        "MemoryStore: sqlite-vec not available, using keyword search only",
      );
      this.vectorEnabled = false;
    }
  }

  saveChunk(
    chunk: Omit<MemoryChunk, "id" | "createdAt" | "updatedAt">,
  ): string {
    const now = new Date().toISOString();
    const id = `chunk_${createHash("sha256")
      .update(chunk.contentHash + now)
      .digest("hex")
      .slice(0, 12)}`;

    const stmt = this.db.prepare(`
      INSERT INTO memory_chunks (id, file_path, content, content_hash, start_line, end_line, token_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(content_hash) DO UPDATE SET
        file_path = excluded.file_path,
        content = excluded.content,
        start_line = excluded.start_line,
        end_line = excluded.end_line,
        token_count = excluded.token_count,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      id,
      chunk.filePath,
      chunk.content,
      chunk.contentHash,
      chunk.startLine ?? null,
      chunk.endLine ?? null,
      chunk.tokenCount ?? null,
      now,
      now,
    );

    return id;
  }

  saveChunks(
    chunks: Array<Omit<MemoryChunk, "id" | "createdAt" | "updatedAt">>,
  ): string[] {
    const ids: string[] = [];
    const transaction = this.db.transaction(() => {
      for (const chunk of chunks) {
        ids.push(this.saveChunk(chunk));
      }
    });
    transaction();
    return ids;
  }

  saveEmbedding(chunkId: string, embedding: number[]): void {
    if (!this.vectorEnabled) return;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO memory_vec (chunk_id, embedding)
        VALUES (?, ?)
        ON CONFLICT(chunk_id) DO UPDATE SET
          embedding = excluded.embedding
      `);
      stmt.run(chunkId, new Float32Array(embedding));
    } catch (error) {
      console.error("Failed to save embedding:", error);
    }
  }

  getEmbeddingCache(contentHash: string): number[] | null {
    const row = this.db
      .prepare(`SELECT embedding FROM embedding_cache WHERE content_hash = ?`)
      .get(contentHash) as { embedding: Buffer } | undefined;

    if (!row) return null;

    return Array.from(new Float32Array(row.embedding.buffer));
  }

  saveEmbeddingCache(
    contentHash: string,
    embedding: number[],
    model: string,
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO embedding_cache (content_hash, embedding, model, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(content_hash) DO UPDATE SET
        embedding = excluded.embedding,
        model = excluded.model,
        created_at = excluded.created_at
    `);

    const buffer = Buffer.from(new Float32Array(embedding).buffer);
    stmt.run(contentHash, buffer, model, new Date().toISOString());
  }

  searchKeyword(query: string, limit = 10): SearchResult[] {
    const stmt = this.db.prepare(`
      SELECT
        mc.id, mc.file_path, mc.content, mc.content_hash,
        mc.start_line, mc.end_line, mc.token_count,
        mc.created_at, mc.updated_at,
        bm25(memory_fts) as score
      FROM memory_fts
      JOIN memory_chunks mc ON memory_fts.rowid = mc.rowid
      WHERE memory_fts MATCH ?
      ORDER BY bm25(memory_fts)
      LIMIT ?
    `);

    const rows = stmt.all(query, limit) as Array<
      Record<string, unknown> & { score: number }
    >;

    return rows.map((row) => ({
      chunk: this.parseChunkRow(row),
      score: Math.abs(row.score),
      matchType: "keyword" as const,
    }));
  }

  searchVector(embedding: number[], limit = 10): SearchResult[] {
    if (!this.vectorEnabled) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT
          mc.id, mc.file_path, mc.content, mc.content_hash,
          mc.start_line, mc.end_line, mc.token_count,
          mc.created_at, mc.updated_at,
          mv.distance as score
        FROM memory_vec mv
        JOIN memory_chunks mc ON mv.chunk_id = mc.id
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
      `);

      const rows = stmt.all(new Float32Array(embedding), limit) as Array<
        Record<string, unknown> & { score: number }
      >;

      return rows.map((row) => ({
        chunk: this.parseChunkRow(row),
        score: 1 - row.score,
        matchType: "vector" as const,
      }));
    } catch (error) {
      console.error("Vector search failed:", error);
      return [];
    }
  }

  searchHybrid(options: SearchOptions, embedding?: number[]): SearchResult[] {
    const {
      query,
      limit = 10,
      vectorWeight = 0.7,
      keywordWeight = 0.3,
    } = options;

    const keywordResults = this.searchKeyword(query, limit * 2);
    const vectorResults = embedding
      ? this.searchVector(embedding, limit * 2)
      : [];

    const scoreMap = new Map<string, { chunk: MemoryChunk; score: number }>();

    const addResults = (results: SearchResult[], weight: number): void => {
      const maxScore = Math.max(...results.map((r) => r.score), 0.001);
      for (const result of results) {
        const normalizedScore = (result.score / maxScore) * weight;
        const existing = scoreMap.get(result.chunk.id);
        if (existing) {
          existing.score += normalizedScore;
        } else {
          scoreMap.set(result.chunk.id, {
            chunk: result.chunk,
            score: normalizedScore,
          });
        }
      }
    };

    addResults(keywordResults, keywordWeight);
    if (vectorResults.length > 0) {
      addResults(vectorResults, vectorWeight);
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ chunk, score }) => ({
        chunk,
        score,
        matchType: "hybrid" as const,
      }));
  }

  getById(id: string): MemoryChunk | null {
    const row = this.db
      .prepare(`SELECT * FROM memory_chunks WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.parseChunkRow(row) : null;
  }

  getByFilePath(filePath: string): MemoryChunk[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_chunks WHERE file_path = ? ORDER BY start_line ASC`,
      )
      .all(filePath) as Array<Record<string, unknown>>;

    return rows.map((row) => this.parseChunkRow(row));
  }

  getByContentHash(contentHash: string): MemoryChunk | null {
    const row = this.db
      .prepare(`SELECT * FROM memory_chunks WHERE content_hash = ?`)
      .get(contentHash) as Record<string, unknown> | undefined;

    return row ? this.parseChunkRow(row) : null;
  }

  getExistingHashes(filePath: string): Set<string> {
    const rows = this.db
      .prepare(`SELECT content_hash FROM memory_chunks WHERE file_path = ?`)
      .all(filePath) as Array<{ content_hash: string }>;

    return new Set(rows.map((r) => r.content_hash));
  }

  deleteByFilePath(filePath: string): number {
    const result = this.db
      .prepare(`DELETE FROM memory_chunks WHERE file_path = ?`)
      .run(filePath);

    if (this.vectorEnabled) {
      try {
        this.db.exec(`
          DELETE FROM memory_vec
          WHERE chunk_id NOT IN (SELECT id FROM memory_chunks)
        `);
      } catch {
        // sqlite-vec cleanup failure is non-critical
      }
    }

    return result.changes;
  }

  deleteExcept(filePath: string, keepHashes: string[]): number {
    if (keepHashes.length === 0) {
      return this.deleteByFilePath(filePath);
    }

    const placeholders = keepHashes.map(() => "?").join(",");
    const result = this.db
      .prepare(
        `DELETE FROM memory_chunks WHERE file_path = ? AND content_hash NOT IN (${placeholders})`,
      )
      .run(filePath, ...keepHashes);

    return result.changes;
  }

  getStats(): MemoryStoreStats {
    const countRow = this.db
      .prepare(
        `SELECT COUNT(*) as count, SUM(token_count) as tokens FROM memory_chunks`,
      )
      .get() as { count: number; tokens: number | null };

    const fileCountRow = this.db
      .prepare(`SELECT COUNT(DISTINCT file_path) as count FROM memory_chunks`)
      .get() as { count: number };

    const lastUpdatedRow = this.db
      .prepare(`SELECT MAX(updated_at) as last FROM memory_chunks`)
      .get() as { last: string | null };

    return {
      totalChunks: countRow.count,
      totalTokens: countRow.tokens ?? 0,
      fileCount: fileCountRow.count,
      lastUpdated: lastUpdatedRow.last,
    };
  }

  isVectorEnabled(): boolean {
    return this.vectorEnabled;
  }

  private parseChunkRow(row: Record<string, unknown>): MemoryChunk {
    const parsed = MemoryChunkSchema.safeParse({
      id: row.id,
      filePath: row.file_path,
      content: row.content,
      contentHash: row.content_hash,
      startLine: row.start_line,
      endLine: row.end_line,
      tokenCount: row.token_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

    if (!parsed.success) {
      throw new Error(`Invalid chunk row: ${JSON.stringify(parsed.error)}`);
    }

    return parsed.data;
  }

  close(): void {
    this.db.close();
  }
}
