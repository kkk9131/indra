#!/usr/bin/env npx tsx
/**
 * ログ解析スキルスクリプト
 *
 * 使用方法:
 *   npx tsx log-analyze.ts [--input <file>] [--output <file>]
 *   cat logs.json | npx tsx log-analyze.ts
 */

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LogEntry } from "../../../../src/platform/logs/types.js";
import type { DailyStats } from "../../../../src/orchestrator/analytics/types.js";

interface LogInput {
  logs: LogEntry[];
  metadata?: {
    totalCount: number;
    periodStart: string;
    periodEnd: string;
  };
}

interface LogAnalyzeOutput {
  stats: DailyStats;
}

const { values } = parseArgs({
  options: {
    input: { type: "string", short: "i" },
    output: { type: "string", short: "o" },
  },
  strict: true,
});

/**
 * ログから統計情報を計算
 * src/analytics/analyzer.ts の calculateStats() と同等のロジック
 */
function calculateStats(logs: LogEntry[]): DailyStats {
  const stats: DailyStats = {
    totalLogs: logs.length,
    agentLogs: 0,
    promptLogs: 0,
    systemLogs: 0,
    errorCount: 0,
    warningCount: 0,
    toolUsage: {},
    uniqueSessions: 0,
  };

  const sessions = new Set<string>();

  for (const log of logs) {
    // タイプ別カウント
    switch (log.type) {
      case "agent":
        stats.agentLogs++;
        break;
      case "prompt":
        stats.promptLogs++;
        break;
      case "system":
        stats.systemLogs++;
        break;
    }

    // エラー・警告カウント
    if (log.type === "system") {
      if (log.level === "error") {
        stats.errorCount++;
      } else if (log.level === "warn") {
        stats.warningCount++;
      }
    }

    // ツール使用状況
    if (log.type === "agent" && log.agentAction === "tool_start" && log.tool) {
      stats.toolUsage[log.tool] = (stats.toolUsage[log.tool] ?? 0) + 1;
    }

    // セッション
    if (log.sessionId) {
      sessions.add(log.sessionId);
    }
  }

  stats.uniqueSessions = sessions.size;

  return stats;
}

/**
 * 標準入力からデータを読み込む
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main(): Promise<void> {
  let inputJson: string;

  // 入力取得
  if (values.input) {
    const inputPath = resolve(values.input);
    inputJson = readFileSync(inputPath, "utf-8");
  } else {
    // 標準入力から読み込み
    inputJson = await readStdin();
  }

  // パース
  let input: LogInput;
  try {
    input = JSON.parse(inputJson) as LogInput;
  } catch {
    console.error("エラー: 入力JSONのパースに失敗しました");
    process.exit(1);
  }

  if (!Array.isArray(input.logs)) {
    console.error("エラー: 入力に logs 配列が含まれていません");
    process.exit(1);
  }

  // 統計計算
  const stats = calculateStats(input.logs);

  // 出力構築
  const output: LogAnalyzeOutput = { stats };
  const jsonOutput = JSON.stringify(output, null, 2);

  // 出力
  if (values.output) {
    const outputPath = resolve(values.output);
    writeFileSync(outputPath, jsonOutput, "utf-8");
    console.error(`出力完了: ${outputPath}`);
  } else {
    console.log(jsonOutput);
  }
}

main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});
