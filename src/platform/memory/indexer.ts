import { createHash } from "node:crypto";
import type { ChunkInput, ChunkResult, EmbeddingProvider } from "./types.js";
import type { MemoryStore } from "./store.js";

const DEFAULT_CHUNK_SIZE = 400;
const DEFAULT_OVERLAP = 80;

export function estimateTokens(text: string): number {
  const japaneseChars = (text.match(/[\u3000-\u9fff]/g) || []).length;
  const otherChars = text.length - japaneseChars;
  return Math.ceil(japaneseChars * 0.7 + otherChars / 4);
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {},
): Array<{ content: string; startLine: number; endLine: number }> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  const lines = text.split("\n");
  const chunks: Array<{ content: string; startLine: number; endLine: number }> =
    [];

  let currentChunk: string[] = [];
  let currentTokens = 0;
  let chunkStartLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTokens = estimateTokens(line);

    // 見出しまたは空行でチャンク区切り（現在のチャンクが十分大きい場合）
    const isHeading = line.startsWith("#");
    const isEmptyLine = line.trim() === "";
    const shouldSplit =
      currentTokens > chunkSize * 0.5 && (isHeading || isEmptyLine);

    if (shouldSplit && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join("\n"),
        startLine: chunkStartLine,
        endLine: i,
      });

      // オーバーラップ処理: 最後の数行を次のチャンクに含める
      const overlapLines: string[] = [];
      let overlapTokens = 0;
      for (
        let j = currentChunk.length - 1;
        j >= 0 && overlapTokens < overlap;
        j--
      ) {
        overlapLines.unshift(currentChunk[j]);
        overlapTokens += estimateTokens(currentChunk[j]);
      }

      currentChunk = overlapLines;
      currentTokens = overlapTokens;
      chunkStartLine = i - overlapLines.length + 1;
    }

    currentChunk.push(line);
    currentTokens += lineTokens;

    // チャンクサイズを超えた場合
    if (currentTokens > chunkSize) {
      chunks.push({
        content: currentChunk.join("\n"),
        startLine: chunkStartLine,
        endLine: i + 1,
      });

      // オーバーラップ処理
      const overlapLines: string[] = [];
      let overlapTokens = 0;
      for (
        let j = currentChunk.length - 1;
        j >= 0 && overlapTokens < overlap;
        j--
      ) {
        overlapLines.unshift(currentChunk[j]);
        overlapTokens += estimateTokens(currentChunk[j]);
      }

      currentChunk = overlapLines;
      currentTokens = overlapTokens;
      chunkStartLine = i - overlapLines.length + 2;
    }
  }

  // 残りのチャンクを追加
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join("\n"),
      startLine: chunkStartLine,
      endLine: lines.length,
    });
  }

  return chunks;
}

/**
 * ファイルをチャンク化
 */
export function chunkFile(input: ChunkInput): ChunkResult {
  const { content, existingHashes } = input;

  const rawChunks = chunkText(content);
  const chunks: ChunkResult["chunks"] = [];
  const unchanged: string[] = [];

  for (const raw of rawChunks) {
    const hash = hashContent(raw.content);

    if (existingHashes?.has(hash)) {
      unchanged.push(hash);
      continue;
    }

    chunks.push({
      content: raw.content,
      startLine: raw.startLine,
      endLine: raw.endLine,
      tokenCount: estimateTokens(raw.content),
      hash,
    });
  }

  return { chunks, unchanged };
}

export class MemoryIndexer {
  constructor(
    private store: MemoryStore,
    private embeddingProvider: EmbeddingProvider,
  ) {}

  async indexFile(
    filePath: string,
    content: string,
  ): Promise<{ added: number; unchanged: number; removed: number }> {
    const existingHashes = this.store.getExistingHashes(filePath);
    const { chunks, unchanged } = chunkFile({
      content,
      filePath,
      existingHashes,
    });

    const chunksToEmbed: Array<{ chunk: (typeof chunks)[0]; index: number }> =
      [];
    const cachedEmbeddings = new Map<number, number[]>();

    for (let i = 0; i < chunks.length; i++) {
      const cached = this.store.getEmbeddingCache(chunks[i].hash);
      if (cached) {
        cachedEmbeddings.set(i, cached);
      } else {
        chunksToEmbed.push({ chunk: chunks[i], index: i });
      }
    }

    const newEmbeddings =
      chunksToEmbed.length > 0
        ? await this.embeddingProvider.embedBatch(
            chunksToEmbed.map((c) => c.chunk.content),
          )
        : [];

    const transaction = this.store["db"].transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const id = this.store.saveChunk({
          filePath,
          content: chunk.content,
          contentHash: chunk.hash,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          tokenCount: chunk.tokenCount,
        });

        const embedding =
          cachedEmbeddings.get(i) ??
          newEmbeddings[chunksToEmbed.findIndex((c) => c.index === i)];

        if (embedding) {
          this.store.saveEmbedding(id, embedding);
          if (!cachedEmbeddings.has(i)) {
            this.store.saveEmbeddingCache(
              chunk.hash,
              embedding,
              this.embeddingProvider.model,
            );
          }
        }
      }

      const keepHashes = [...chunks.map((c) => c.hash), ...unchanged];
      this.store.deleteExcept(filePath, keepHashes);
    });
    transaction();

    return {
      added: chunks.length,
      unchanged: unchanged.length,
      removed: existingHashes.size - unchanged.length,
    };
  }

  deleteFile(filePath: string): number {
    return this.store.deleteByFilePath(filePath);
  }
}
