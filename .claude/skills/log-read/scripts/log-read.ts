#!/usr/bin/env npx tsx
/**
 * ログ読み取りスキルスクリプト
 *
 * 使用方法:
 *   npx tsx log-read.ts [--since <ISO8601>] [--type <all|agent|prompt|system>] [--output <file>]
 */

import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LogStore } from "../../../../src/platform/logs/store.js";
import type { LogEntry } from "../../../../src/platform/logs/types.js";

interface LogReadOutput {
  logs: LogEntry[];
  metadata: {
    totalCount: number;
    periodStart: string;
    periodEnd: string;
  };
}

const { values } = parseArgs({
  options: {
    since: { type: "string", short: "s" },
    type: { type: "string", short: "t" },
    output: { type: "string", short: "o" },
  },
  strict: true,
});

const logType = values.type as
  | "all"
  | "agent"
  | "prompt"
  | "system"
  | undefined;
if (logType && !["all", "agent", "prompt", "system"].includes(logType)) {
  console.error("エラー: --type は all, agent, prompt, system のいずれかです");
  process.exit(1);
}

// 期間設定（デフォルト: 24時間前）
const now = new Date();
let since: Date;
if (values.since) {
  since = new Date(values.since);
  if (isNaN(since.getTime())) {
    console.error(
      "エラー: --since は有効なISO 8601形式の日時を指定してください",
    );
    process.exit(1);
  }
} else {
  since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

// LogStore初期化
const logStore = new LogStore();

try {
  // ログ取得
  let logs = logStore.listSince(since);

  // タイプフィルタ
  if (logType && logType !== "all") {
    logs = logs.filter((log) => log.type === logType);
  }

  // 出力構築
  const output: LogReadOutput = {
    logs,
    metadata: {
      totalCount: logs.length,
      periodStart: since.toISOString(),
      periodEnd: now.toISOString(),
    },
  };

  const jsonOutput = JSON.stringify(output, null, 2);

  // 出力
  if (values.output) {
    const outputPath = resolve(values.output);
    writeFileSync(outputPath, jsonOutput, "utf-8");
    console.error(`出力完了: ${outputPath}`);
  } else {
    console.log(jsonOutput);
  }
} finally {
  logStore.close();
}
