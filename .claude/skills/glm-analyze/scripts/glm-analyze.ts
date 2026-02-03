#!/usr/bin/env npx tsx
/**
 * GLMログ分析スキルスクリプト
 *
 * 使用方法:
 *   npx tsx glm-analyze.ts [--input <file>] [--output <file>]
 *   cat combined.json | npx tsx glm-analyze.ts
 */

import dotenv from "dotenv";
import OpenAI from "openai";
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import type { LogEntry } from "../../../../src/platform/logs/types.js";
import type {
  DailyStats,
  ReportItem,
} from "../../../../src/orchestrator/analytics/types.js";

// .env ファイルを ~/.claude/.env から読み込む
const envPath = join(homedir(), ".claude", ".env");
dotenv.config({ path: envPath });

interface GLMInput {
  logs: LogEntry[];
  stats: DailyStats;
}

interface GLMAnalysisResult {
  summary: string;
  items: ReportItem[];
}

const { values } = parseArgs({
  options: {
    input: { type: "string", short: "i" },
    output: { type: "string", short: "o" },
    model: { type: "string", short: "m" },
  },
  strict: true,
});

const zaiApiKey = process.env.ZAI_API_KEY;

if (!zaiApiKey) {
  console.error("環境変数 ZAI_API_KEY が必要です");
  process.exit(1);
}

const model = values.model ?? "glm-4.7";

const glmClient = new OpenAI({
  apiKey: zaiApiKey,
  baseURL: "https://api.z.ai/api/coding/paas/v4",
});

function getSystemPrompt(): string {
  return `あなたはログ分析エキスパートです。与えられたログと統計情報を分析し、1日の活動を詳細にレポートしてください。

以下のJSON形式で回答してください:
{
  "summary": "日本語で200-400文字程度の詳細な要約。1日の流れ（時間帯ごとの活動、主要なタスク、成果）を含める",
  "items": [
    {
      "severity": "info" | "warning" | "error",
      "category": "error" | "performance" | "usage" | "anomaly",
      "title": "短いタイトル",
      "description": "詳細な説明（50-100文字）。エラーの場合は原因と影響を具体的に記述"
    }
  ]
}

分析ポイント:
1. **1日の流れ**: 時間帯ごとの活動パターン（朝/昼/夜の利用状況）
2. **主要タスク**: 実行されたタスクの種類と目的
3. **ツール使用**: どのツールがどのような目的で使われたか
4. **エラー詳細**: エラーがあれば、発生時刻・原因・影響・対処法を記述
5. **パフォーマンス**: 応答時間や処理速度の傾向
6. **改善提案**: 効率化や問題解決のための提案

summaryには必ず以下を含めてください:
- 何時頃にどのような作業が行われたか
- 主な成果や完了したタスク
- 注意が必要な点`;
}

function buildAnalysisPrompt(logs: LogEntry[], stats: DailyStats): string {
  // 時間帯ごとにログを分類
  const logsByHour: Record<string, number> = {};
  const errorLogs: Array<{ time: string; message: string; tool?: string }> = [];

  logs.forEach((log) => {
    const date = new Date(log.timestamp);
    const hour = date.getHours().toString().padStart(2, "0") + ":00";
    logsByHour[hour] = (logsByHour[hour] || 0) + 1;

    // エラーログを収集
    if (log.level === "error" || log.agentAction === "tool_result") {
      const result = log.toolResult || log.message || "";
      if (
        result.toLowerCase().includes("error") ||
        result.toLowerCase().includes("fail")
      ) {
        errorLogs.push({
          time: date.toLocaleTimeString("ja-JP"),
          message: result.substring(0, 200),
          tool: log.tool ?? undefined,
        });
      }
    }
  });

  // 最新50件のログサンプルを取得（textフィールドも含める）
  const recentLogs = logs.slice(-50).map((log) => ({
    type: log.type,
    timestamp: log.timestamp,
    agentAction: log.agentAction,
    tool: log.tool,
    text: log.text?.substring(0, 100),
    level: log.level,
    message: log.message,
  }));

  // Top 5 ツール使用
  const topTools = Object.entries(stats.toolUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // 時間帯の活動を文字列化
  const hourlyActivity = Object.entries(logsByHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => `${hour}: ${count}件`)
    .join(", ");

  return `## 統計情報
- 総ログ数: ${stats.totalLogs}
- エージェントログ: ${stats.agentLogs}
- プロンプトログ: ${stats.promptLogs}
- システムログ: ${stats.systemLogs}
- エラー数: ${stats.errorCount}
- 警告数: ${stats.warningCount}
- ユニークセッション数: ${stats.uniqueSessions}

## 時間帯別活動
${hourlyActivity || "データなし"}

## Top 5 ツール使用
${topTools.length > 0 ? topTools.map(([tool, count]) => `- ${tool}: ${count}回`).join("\n") : "ツール使用なし"}

## エラー/失敗ログ
${errorLogs.length > 0 ? errorLogs.map((e) => `- ${e.time} [${e.tool || "system"}]: ${e.message}`).join("\n") : "エラーなし"}

## 最新ログサンプル (50件)
${JSON.stringify(recentLogs, null, 2)}

上記の情報を分析し、1日の活動を詳細にレポートしてください。`;
}

function parseAnalysisResponse(content: string): GLMAnalysisResult {
  try {
    const parsed = JSON.parse(content) as {
      summary?: string;
      items?: Array<{
        severity?: string;
        category?: string;
        title?: string;
        description?: string;
      }>;
    };

    const items: ReportItem[] = (parsed.items ?? [])
      .filter(
        (item): item is ReportItem =>
          typeof item.severity === "string" &&
          typeof item.category === "string" &&
          typeof item.title === "string" &&
          typeof item.description === "string" &&
          ["info", "warning", "error"].includes(item.severity) &&
          ["error", "performance", "usage", "anomaly"].includes(item.category),
      )
      .slice(0, 10);

    return {
      summary: parsed.summary ?? "分析結果を取得できませんでした。",
      items,
    };
  } catch {
    return {
      summary: "分析結果のパースに失敗しました。",
      items: [],
    };
  }
}

function generateFallbackAnalysis(stats: DailyStats): GLMAnalysisResult {
  const items: ReportItem[] = [];

  if (stats.errorCount > 0) {
    items.push({
      severity: "error",
      category: "error",
      title: `${stats.errorCount}件のエラーを検出`,
      description: `過去24時間で${stats.errorCount}件のエラーが発生しています。`,
    });
  }

  if (stats.warningCount > 0) {
    items.push({
      severity: "warning",
      category: "anomaly",
      title: `${stats.warningCount}件の警告を検出`,
      description: `過去24時間で${stats.warningCount}件の警告が発生しています。`,
    });
  }

  const topTools = Object.entries(stats.toolUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (topTools.length > 0) {
    items.push({
      severity: "info",
      category: "usage",
      title: "最も使用されたツール",
      description: topTools
        .map(([tool, count]) => `${tool}(${count}回)`)
        .join(", "),
    });
  }

  const summary =
    `過去24時間で${stats.totalLogs}件のログを記録。` +
    `エージェント: ${stats.agentLogs}件、プロンプト: ${stats.promptLogs}件、システム: ${stats.systemLogs}件。` +
    `${stats.uniqueSessions}セッション、${stats.errorCount}エラー、${stats.warningCount}警告。`;

  return { summary, items };
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
  let input: GLMInput;
  try {
    input = JSON.parse(inputJson) as GLMInput;
  } catch {
    console.error("エラー: 入力JSONのパースに失敗しました");
    process.exit(1);
  }

  if (!Array.isArray(input.logs)) {
    console.error("エラー: 入力に logs 配列が含まれていません");
    process.exit(1);
  }

  if (!input.stats) {
    console.error("エラー: 入力に stats が含まれていません");
    process.exit(1);
  }

  // ログが空の場合はデフォルト結果
  if (input.logs.length === 0) {
    const output: GLMAnalysisResult = {
      summary: "過去24時間のログはありません。",
      items: [],
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // GLM API呼び出し
  let result: GLMAnalysisResult;
  try {
    console.error(`[GLM] Z.ai (${model}) にリクエスト中...`);
    const start = Date.now();

    const completion = await glmClient.chat.completions.create({
      model,
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: buildAnalysisPrompt(input.logs, input.stats) },
      ],
      response_format: { type: "json_object" },
    });

    const duration = Date.now() - start;
    console.error(`[GLM] Z.ai 成功 (${duration}ms)`);

    const content = completion.choices[0]?.message?.content ?? "{}";
    result = parseAnalysisResponse(content);
  } catch (error) {
    console.error("[GLM] API呼び出し失敗、フォールバック分析を使用:", error);
    result = generateFallbackAnalysis(input.stats);
  }

  const jsonOutput = JSON.stringify(result, null, 2);

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
