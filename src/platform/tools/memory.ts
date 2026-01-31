import { z } from "zod";
import { join, dirname } from "node:path";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import type { MemoryStore } from "../memory/store.js";
import type { MemorySearch } from "../memory/search.js";
import type { MemoryIndexer } from "../memory/indexer.js";
import { getMemoryBasePath, getTodayNotePath } from "../memory/types.js";

// ===== Schemas =====

export const MemorySearchInputSchema = z.object({
  query: z.string().describe("検索クエリ（自然言語またはキーワード）"),
  limit: z.number().optional().default(5).describe("返す結果の最大数"),
  minScore: z.number().optional().default(0.1).describe("最小スコア閾値"),
});

export const MemoryGetInputSchema = z.object({
  filePath: z
    .string()
    .optional()
    .describe("取得するファイルパス（省略時はMEMORY.md）"),
});

export const MemoryWriteInputSchema = z.object({
  content: z.string().describe("保存するコンテンツ"),
  filePath: z
    .string()
    .optional()
    .describe(
      "保存先ファイルパス（省略時は今日の日次ノート memory/YYYY-MM-DD.md）",
    ),
  append: z
    .boolean()
    .optional()
    .default(true)
    .describe("追記モード（デフォルトtrue）"),
});

export type MemorySearchInput = z.infer<typeof MemorySearchInputSchema>;
export type MemoryGetInput = z.infer<typeof MemoryGetInputSchema>;
export type MemoryWriteInput = z.infer<typeof MemoryWriteInputSchema>;

// ===== Tool Definitions =====

export const MEMORY_TOOLS = [
  {
    name: "memory_search",
    description:
      "長期記憶を検索します。セマンティック検索とキーワード検索のハイブリッドで行われます。",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "検索クエリ（自然言語またはキーワード）",
        },
        limit: {
          type: "number",
          description: "返す結果の最大数（デフォルト5）",
        },
        minScore: {
          type: "number",
          description: "最小スコア閾値（デフォルト0.1）",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_get",
    description:
      "特定のメモリファイルの内容を取得します。省略時はMEMORY.mdを取得。",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "取得するファイルパス（省略時はMEMORY.md）",
        },
      },
    },
  },
  {
    name: "memory_write",
    description:
      "メモリに情報を書き込みます。デフォルトでは今日の日次ノートに追記されます。",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "保存するコンテンツ" },
        filePath: {
          type: "string",
          description:
            "保存先ファイルパス（省略時は今日の日次ノート memory/YYYY-MM-DD.md）",
        },
        append: {
          type: "boolean",
          description: "追記モード（デフォルトtrue）",
        },
      },
      required: ["content"],
    },
  },
];

// ===== Handlers =====

function normalizeFilePath(filePath?: string): string {
  if (!filePath) return getTodayNotePath();
  if (filePath.startsWith("/")) return filePath;
  if (filePath === "MEMORY.md") return join(getMemoryBasePath(), "MEMORY.md");
  return join(getMemoryBasePath(), filePath);
}

export async function handleMemorySearch(
  search: MemorySearch,
  input: MemorySearchInput,
): Promise<string> {
  const { query, limit = 5, minScore = 0.1 } = input;

  const results = await search.search({
    query,
    limit,
    minScore,
  });

  if (results.length === 0) {
    return "関連する記憶が見つかりませんでした。";
  }

  const formatted = results
    .map((r, i) => {
      const lines =
        r.chunk.startLine && r.chunk.endLine
          ? ` (L${r.chunk.startLine}-${r.chunk.endLine})`
          : "";
      return `## 結果 ${i + 1} (スコア: ${r.score.toFixed(3)})
ファイル: ${r.chunk.filePath}${lines}

${r.chunk.content}`;
    })
    .join("\n\n---\n\n");

  return formatted;
}

export async function handleMemoryGet(
  search: MemorySearch,
  _store: MemoryStore,
  input: MemoryGetInput,
): Promise<string> {
  const filePath = normalizeFilePath(input.filePath ?? "MEMORY.md");

  const storedContent = search.getFileContent(filePath);
  if (storedContent) return storedContent;

  if (existsSync(filePath)) {
    return await readFile(filePath, "utf-8");
  }

  return `ファイルが見つかりません: ${filePath}`;
}

export async function handleMemoryWrite(
  indexer: MemoryIndexer,
  input: MemoryWriteInput,
): Promise<string> {
  const { content, append = true } = input;
  const filePath = normalizeFilePath(input.filePath);

  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  const formattedContent = append
    ? `\n\n## ${timestamp}\n\n${content}`
    : content;

  if (append && existsSync(filePath)) {
    await appendFile(filePath, formattedContent, "utf-8");
  } else {
    await writeFile(filePath, formattedContent, "utf-8");
  }

  const fullContent = await readFile(filePath, "utf-8");
  const result = await indexer.indexFile(filePath, fullContent);

  return `メモリに保存しました: ${filePath}
- 追加: ${result.added} チャンク
- 変更なし: ${result.unchanged} チャンク
- 削除: ${result.removed} チャンク`;
}

export class MemoryToolHandler {
  constructor(
    private store: MemoryStore,
    private search: MemorySearch,
    private indexer: MemoryIndexer,
  ) {}

  async handle(
    toolName: string,
    input: unknown,
  ): Promise<{ success: boolean; result: string }> {
    try {
      switch (toolName) {
        case "memory_search": {
          const parsed = MemorySearchInputSchema.parse(input);
          const result = await handleMemorySearch(this.search, parsed);
          return { success: true, result };
        }

        case "memory_get": {
          const parsed = MemoryGetInputSchema.parse(input);
          const result = await handleMemoryGet(this.search, this.store, parsed);
          return { success: true, result };
        }

        case "memory_write": {
          const parsed = MemoryWriteInputSchema.parse(input);
          const result = await handleMemoryWrite(this.indexer, parsed);
          return { success: true, result };
        }

        default:
          return { success: false, result: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, result: `Error: ${message}` };
    }
  }
}
