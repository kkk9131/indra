import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";

import type { BootstrapContext } from "./types.js";
import { getMemoryBasePath } from "./types.js";

const INITIAL_MEMORY_TEMPLATE = `# Long-Term Memory

このファイルはエージェントの長期記憶です。
重要な情報をここに記録してください。

## ユーザー情報

- 名前:
- 好み:

## プロジェクト設定

## 重要な決定事項

## 学習した知識
`;

export async function ensureMemoryFiles(): Promise<void> {
  const basePath = getMemoryBasePath();
  const memoryPath = join(basePath, "MEMORY.md");
  const memoryDir = join(basePath, "memory");

  // ~/.indra ディレクトリを作成
  if (!existsSync(basePath)) {
    mkdirSync(basePath, { recursive: true });
  }

  // ~/.indra/memory ディレクトリを作成
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  // MEMORY.md が存在しなければ初期テンプレートを作成
  if (!existsSync(memoryPath)) {
    await writeFile(memoryPath, INITIAL_MEMORY_TEMPLATE, "utf-8");
  }
}

async function loadLongTermMemory(): Promise<string | null> {
  const memoryPath = join(getMemoryBasePath(), "MEMORY.md");
  if (!existsSync(memoryPath)) return null;

  try {
    return await readFile(memoryPath, "utf-8");
  } catch {
    return null;
  }
}

async function loadRecentNotes(): Promise<
  Array<{ date: string; content: string }>
> {
  const basePath = join(getMemoryBasePath(), "memory");
  const notes: Array<{ date: string; content: string }> = [];

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dates = [
    today.toISOString().split("T")[0],
    yesterday.toISOString().split("T")[0],
  ];

  for (const date of dates) {
    const notePath = join(basePath, `${date}.md`);
    if (existsSync(notePath)) {
      try {
        const content = await readFile(notePath, "utf-8");
        notes.push({ date, content });
      } catch {
        // Skip on error
      }
    }
  }

  return notes;
}

export async function getBootstrapContext(): Promise<BootstrapContext> {
  const [longTermMemory, recentNotes] = await Promise.all([
    loadLongTermMemory(),
    loadRecentNotes(),
  ]);

  return {
    longTermMemory,
    recentNotes,
  };
}

export function formatBootstrapContext(context: BootstrapContext): string {
  const sections: string[] = [];

  if (context.longTermMemory) {
    sections.push(`## 長期記憶 (MEMORY.md)

${context.longTermMemory}`);
  }

  if (context.recentNotes.length > 0) {
    const notesSection = context.recentNotes
      .map(
        (note) => `### ${note.date}

${note.content}`,
      )
      .join("\n\n");

    sections.push(`## 最近のノート

${notesSection}`);
  }

  if (sections.length === 0) {
    return "";
  }

  return `<memory>
${sections.join("\n\n")}
</memory>`;
}

export async function getMemoryContextForSession(): Promise<string> {
  const context = await getBootstrapContext();
  return formatBootstrapContext(context);
}
