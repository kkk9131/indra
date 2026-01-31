import { dirname } from "node:path";
import { writeFile, appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import type { FlushResult } from "./types.js";
import type { MemoryIndexer } from "./indexer.js";
import { getTodayNotePath } from "./types.js";

export async function flushMemory(
  summary: string,
  indexer?: MemoryIndexer,
): Promise<FlushResult> {
  const filePath = getTodayNotePath();

  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const content = `\n\n## ${timestamp}\n\n${summary}`;

    if (existsSync(filePath)) {
      await appendFile(filePath, content, "utf-8");
    } else {
      await writeFile(filePath, content.trimStart(), "utf-8");
    }

    if (indexer) {
      const fullContent = await readFile(filePath, "utf-8");
      await indexer.indexFile(filePath, fullContent);
    }

    return {
      success: true,
      savedTo: filePath,
      summary: `メモリを ${filePath} に保存しました`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      savedTo: filePath,
      summary: `メモリ保存に失敗しました`,
      error: message,
    };
  }
}

export function createFlushMessage(
  contextUsage: number,
  maxContext: number,
): string {
  const usagePercent = Math.round((contextUsage / maxContext) * 100);

  return `[システム] コンテキスト使用率が${usagePercent}%に達しました。
重要な情報を長期記憶に保存することをお勧めします。

memory_writeツールを使用して、以下の情報を保存してください:
- 現在のセッションで学んだ重要な情報
- ユーザーの好みや決定事項
- 継続中のタスクの状態

保存後、NO_REPLYを返してコンテキストを解放します。`;
}

export function createSessionEndSummary(sessionInfo: {
  startTime: Date;
  topics: string[];
  decisions: string[];
  todos?: string[];
}): string {
  const duration = Math.round(
    (Date.now() - sessionInfo.startTime.getTime()) / 60000,
  );

  const sections: string[] = [
    `セッション時間: ${duration}分`,
    `開始: ${sessionInfo.startTime.toISOString()}`,
  ];

  if (sessionInfo.topics.length > 0) {
    sections.push(
      `\n### トピック\n${sessionInfo.topics.map((t) => `- ${t}`).join("\n")}`,
    );
  }

  if (sessionInfo.decisions.length > 0) {
    sections.push(
      `\n### 決定事項\n${sessionInfo.decisions.map((d) => `- ${d}`).join("\n")}`,
    );
  }

  if (sessionInfo.todos && sessionInfo.todos.length > 0) {
    sections.push(
      `\n### TODO\n${sessionInfo.todos.map((t) => `- [ ] ${t}`).join("\n")}`,
    );
  }

  return sections.join("\n");
}
