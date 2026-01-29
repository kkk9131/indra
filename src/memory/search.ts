import type { MemoryStore } from "./store.js";
import type {
  EmbeddingProvider,
  SearchOptions,
  SearchResult,
} from "./types.js";

export class MemorySearch {
  constructor(
    private store: MemoryStore,
    private embeddingProvider: EmbeddingProvider,
  ) {}

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, minScore = 0 } = options;

    let queryEmbedding: number[] | undefined;
    if (this.store.isVectorEnabled()) {
      try {
        queryEmbedding = await this.embeddingProvider.embed(query);
      } catch (error) {
        console.error("Failed to generate query embedding:", error);
      }
    }

    const results = this.store.searchHybrid(options, queryEmbedding);
    return results.filter((r) => r.score >= minScore);
  }

  searchKeyword(query: string, limit = 10): SearchResult[] {
    return this.store.searchKeyword(query, limit);
  }

  async searchVector(query: string, limit = 10): Promise<SearchResult[]> {
    if (!this.store.isVectorEnabled()) {
      return [];
    }

    try {
      const embedding = await this.embeddingProvider.embed(query);
      return this.store.searchVector(embedding, limit);
    } catch (error) {
      console.error("Vector search failed:", error);
      return [];
    }
  }

  getFileContent(filePath: string): string {
    const chunks = this.store.getByFilePath(filePath);
    if (chunks.length === 0) return "";

    let result = "";
    let lastEndLine = 0;

    for (const chunk of chunks) {
      const startLine = chunk.startLine ?? 0;

      if (startLine <= lastEndLine) {
        const lines = chunk.content.split("\n");
        const skipLines = lastEndLine - startLine + 1;
        result += lines.slice(skipLines).join("\n");
      } else {
        if (result && !result.endsWith("\n")) {
          result += "\n";
        }
        result += chunk.content;
      }

      lastEndLine = chunk.endLine ?? lastEndLine;
    }

    return result;
  }
}
