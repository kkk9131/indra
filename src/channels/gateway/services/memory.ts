import type {
  MemoryStore,
  MemoryStoreStats,
  SearchResult,
} from "../../../platform/memory/index.js";
import type { MemorySearch } from "../../../platform/memory/search.js";
import type { MemoryIndexer } from "../../../platform/memory/indexer.js";
import { MemoryToolHandler } from "../../../platform/tools/memory.js";

export interface MemoryService {
  search(
    query: string,
    options?: { limit?: number; minScore?: number },
  ): Promise<SearchResult[]>;
  get(filePath?: string): Promise<string>;
  write(
    content: string,
    options?: { filePath?: string; append?: boolean },
  ): Promise<string>;
  getStats(): MemoryStoreStats;
  indexFile(
    filePath: string,
    content: string,
  ): Promise<{ added: number; unchanged: number; removed: number }>;
  deleteFile(filePath: string): number;
  isVectorEnabled(): boolean;
  getToolHandler(): MemoryToolHandler;
}

interface MemoryServiceDeps {
  store: MemoryStore;
  search: MemorySearch;
  indexer: MemoryIndexer;
}

export function createMemoryService(deps: MemoryServiceDeps): MemoryService {
  const toolHandler = new MemoryToolHandler(
    deps.store,
    deps.search,
    deps.indexer,
  );

  return {
    async search(query, options = {}) {
      return deps.search.search({
        query,
        limit: options.limit ?? 10,
        minScore: options.minScore ?? 0.1,
      });
    },

    async get(filePath) {
      const result = await toolHandler.handle("memory_get", { filePath });
      if (!result.success) throw new Error(result.result);
      return result.result;
    },

    async write(content, options = {}) {
      const result = await toolHandler.handle("memory_write", {
        content,
        filePath: options.filePath,
        append: options.append ?? true,
      });
      if (!result.success) throw new Error(result.result);
      return result.result;
    },

    getStats: () => deps.store.getStats(),
    indexFile: (filePath, content) => deps.indexer.indexFile(filePath, content),
    deleteFile: (filePath) => deps.indexer.deleteFile(filePath),
    isVectorEnabled: () => deps.store.isVectorEnabled(),
    getToolHandler: () => toolHandler,
  };
}
