import { z } from "zod";
import { homedir } from "node:os";
import { join } from "node:path";

// ===== Paths =====

export function getMemoryBasePath(): string {
  return join(homedir(), ".indra");
}

export function getTodayNotePath(): string {
  const today = new Date().toISOString().split("T")[0];
  return join(getMemoryBasePath(), "memory", `${today}.md`);
}

// ===== Schemas =====

export const MemoryChunkSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  content: z.string(),
  contentHash: z.string(),
  startLine: z.number().nullable().optional(),
  endLine: z.number().nullable().optional(),
  tokenCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MemoryChunk = z.infer<typeof MemoryChunkSchema>;

export const SearchResultSchema = z.object({
  chunk: MemoryChunkSchema,
  score: z.number(),
  matchType: z.enum(["vector", "keyword", "hybrid"]),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const EmbeddingCacheSchema = z.object({
  contentHash: z.string(),
  embedding: z.instanceof(Buffer).or(z.array(z.number())),
  model: z.string(),
  createdAt: z.string(),
});

export type EmbeddingCache = z.infer<typeof EmbeddingCacheSchema>;

// ===== Interfaces =====

export interface SearchOptions {
  query: string;
  limit?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  minScore?: number;
}

export interface MemoryWriteInput {
  content: string;
  filePath?: string;
  append?: boolean;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
  model: string;
}

export interface ChunkInput {
  content: string;
  filePath: string;
  existingHashes?: Set<string>;
}

export interface ChunkResult {
  chunks: Array<{
    content: string;
    startLine: number;
    endLine: number;
    tokenCount: number;
    hash: string;
  }>;
  unchanged: string[];
}

export interface MemoryStoreStats {
  totalChunks: number;
  totalTokens: number;
  fileCount: number;
  lastUpdated: string | null;
}

export interface BootstrapContext {
  longTermMemory: string | null;
  recentNotes: Array<{
    date: string;
    content: string;
  }>;
}

export interface FlushResult {
  success: boolean;
  savedTo: string;
  summary: string;
  error?: string;
}
