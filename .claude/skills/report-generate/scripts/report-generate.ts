#!/usr/bin/env npx tsx
/**
 * レポート生成スキルスクリプト
 *
 * 使用方法:
 *   npx tsx report-generate.ts [--input <file>] [--output <file>]
 *   cat input.json | npx tsx report-generate.ts
 */

import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  DailyStats,
  DailyReport,
  ReportItem,
} from "../../../../src/analytics/types.js";
import type { NewsArticle } from "../../../../src/news/types.js";

interface ReportInput {
  stats: DailyStats;
  analysis: {
    summary: string;
    items: ReportItem[];
  };
  period: {
    start: string;
    end: string;
  };
}

interface ReportOutput {
  report: DailyReport;
  article: NewsArticle;
}

const { values } = parseArgs({
  options: {
    input: { type: "string", short: "i" },
    output: { type: "string", short: "o" },
  },
  strict: true,
});

function generateReport(input: ReportInput): DailyReport {
  const now = new Date();
  const id = randomUUID();

  return {
    id,
    source: "log-analysis",
    title: `Daily Log Report - ${now.toLocaleDateString("ja-JP")}`,
    summary: input.analysis.summary,
    stats: input.stats,
    items: input.analysis.items,
    periodStart: input.period.start,
    periodEnd: input.period.end,
    generatedAt: now.toISOString(),
  };
}

function reportToArticle(report: DailyReport): NewsArticle {
  // 統計情報を要約に含める
  const statsInfo = [
    `総ログ: ${report.stats.totalLogs}`,
    `エラー: ${report.stats.errorCount}`,
    `警告: ${report.stats.warningCount}`,
    `セッション: ${report.stats.uniqueSessions}`,
  ].join(" | ");

  const fullSummary = `${report.summary}\n\n📊 ${statsInfo}`;

  return {
    id: report.id,
    source: "log-analysis",
    title: report.title,
    summary: fullSummary,
    url: `#report/${report.id}`,
    publishedAt: report.generatedAt,
    fetchedAt: report.generatedAt,
    body: JSON.stringify(report, null, 2),
    imageUrl: null,
  };
}

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
    inputJson = await readStdin();
  }

  // パース
  let input: ReportInput;
  try {
    input = JSON.parse(inputJson) as ReportInput;
  } catch {
    console.error("エラー: 入力JSONのパースに失敗しました");
    process.exit(1);
  }

  // バリデーション
  if (!input.stats) {
    console.error("エラー: 入力に stats が含まれていません");
    process.exit(1);
  }

  if (!input.analysis) {
    console.error("エラー: 入力に analysis が含まれていません");
    process.exit(1);
  }

  if (!input.period) {
    console.error("エラー: 入力に period が含まれていません");
    process.exit(1);
  }

  // レポート生成
  const report = generateReport(input);
  const article = reportToArticle(report);

  const output: ReportOutput = { report, article };
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
