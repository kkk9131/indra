import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { join } from "node:path";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  getMemoryBasePath,
  getMemoryContextForSession,
  ensureMemoryFiles,
} from "../../platform/memory/index.js";

export function registerMemoryCommand(cli: Command): void {
  const memoryCmd = cli.command("memory").description("長期記憶の操作");

  memoryCmd
    .command("get [file]")
    .description("メモリファイルの内容を取得")
    .action(async (file?: string) => {
      try {
        await ensureMemoryFiles();
        const basePath = getMemoryBasePath();
        const targetPath = file
          ? join(basePath, file)
          : join(basePath, "MEMORY.md");

        if (!existsSync(targetPath)) {
          p.log.error(`File not found: ${targetPath}`);
          process.exit(1);
        }

        const content = await readFile(targetPath, "utf-8");
        console.log(content);
      } catch (error) {
        p.log.error(
          error instanceof Error ? error.message : "Failed to read memory",
        );
        process.exit(1);
      }
    });

  memoryCmd
    .command("write")
    .description("stdin からメモリに書き込み")
    .option("-a, --append", "既存内容に追記")
    .option("-f, --file <file>", "対象ファイル", "MEMORY.md")
    .action(async (options: { append?: boolean; file: string }) => {
      try {
        await ensureMemoryFiles();
        const basePath = getMemoryBasePath();
        const targetPath = join(basePath, options.file);

        // stdin から読み取り
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks).toString("utf-8");

        if (!content.trim()) {
          p.log.warn("Empty input, nothing written");
          return;
        }

        if (options.append) {
          await appendFile(targetPath, `\n${content}`, "utf-8");
          p.log.success(`Appended to ${targetPath}`);
        } else {
          await writeFile(targetPath, content, "utf-8");
          p.log.success(`Written to ${targetPath}`);
        }
      } catch (error) {
        p.log.error(
          error instanceof Error ? error.message : "Failed to write memory",
        );
        process.exit(1);
      }
    });

  memoryCmd
    .command("search <query>")
    .description("メモリを検索")
    .option("-l, --limit <n>", "結果数", "5")
    .action(async (query: string, options: { limit: string }) => {
      try {
        await ensureMemoryFiles();
        const basePath = getMemoryBasePath();
        const memoryPath = join(basePath, "MEMORY.md");
        const limit = parseInt(options.limit, 10);

        if (!existsSync(memoryPath)) {
          p.log.info("No memory file found");
          return;
        }

        const content = await readFile(memoryPath, "utf-8");
        const lines = content.split("\n");
        const results: Array<{ line: number; content: string }> = [];

        const queryLower = query.toLowerCase();
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            results.push({ line: i + 1, content: lines[i] });
            if (results.length >= limit) break;
          }
        }

        if (results.length === 0) {
          p.log.info(`No matches found for "${query}"`);
          return;
        }

        p.note(
          results
            .map((r) => `${chalk.dim(`L${r.line}:`)} ${r.content}`)
            .join("\n"),
          `Search results for "${query}"`,
        );
      } catch (error) {
        p.log.error(
          error instanceof Error ? error.message : "Failed to search memory",
        );
        process.exit(1);
      }
    });

  memoryCmd
    .command("context")
    .description("現在のメモリコンテキストを表示")
    .action(async () => {
      try {
        await ensureMemoryFiles();
        const context = await getMemoryContextForSession();

        if (!context) {
          p.log.info("No memory context available");
          return;
        }

        console.log(chalk.bold("Memory Context:"));
        console.log(chalk.dim("─".repeat(40)));
        console.log(context);
        console.log(chalk.dim("─".repeat(40)));
        console.log(chalk.dim(`Length: ${context.length} characters`));
      } catch (error) {
        p.log.error(
          error instanceof Error ? error.message : "Failed to get context",
        );
        process.exit(1);
      }
    });

  memoryCmd
    .command("path")
    .description("メモリファイルのパスを表示")
    .action(async () => {
      const basePath = getMemoryBasePath();
      console.log(join(basePath, "MEMORY.md"));
    });
}
