import OpenAI from "openai";
import { randomUUID } from "node:crypto";

import type { LogEntry } from "../logs/types.js";
import { LogStore } from "../logs/store.js";
import type { DailyStats, DailyReport, ReportItem } from "./types.js";

interface AnalysisResult {
  summary: string;
  items: ReportItem[];
}

export class LogAnalyzer {
  private logStore: LogStore;
  private glmClient: OpenAI;

  constructor(logStore: LogStore) {
    this.logStore = logStore;

    const apiKey = process.env.ZAI_API_KEY;
    if (!apiKey) {
      throw new Error("ZAI_API_KEY environment variable is required");
    }

    this.glmClient = new OpenAI({
      apiKey,
      baseURL: "https://api.z.ai/api/coding/paas/v4",
    });
  }

  /**
   * 直近24時間のログを分析してレポートを生成
   */
  async generateDailyReport(): Promise<DailyReport> {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const logs = this.logStore.listSince(since);
    const stats = this.calculateStats(logs);
    const analysis = await this.analyzeWithGLM(logs, stats);

    const report: DailyReport = {
      id: randomUUID(),
      source: "log-analysis",
      title: `Daily Log Report - ${now.toLocaleDateString("ja-JP")}`,
      summary: analysis.summary,
      stats,
      items: analysis.items,
      periodStart: since.toISOString(),
      periodEnd: now.toISOString(),
      generatedAt: now.toISOString(),
    };

    return report;
  }

  /**
   * ログから統計情報を計算
   */
  calculateStats(logs: LogEntry[]): DailyStats {
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
      if (
        log.type === "agent" &&
        log.agentAction === "tool_start" &&
        log.tool
      ) {
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
   * GLM APIを使ってログを分析
   */
  private async analyzeWithGLM(
    logs: LogEntry[],
    stats: DailyStats,
  ): Promise<AnalysisResult> {
    // ログが空の場合はデフォルトの結果を返す
    if (logs.length === 0) {
      return {
        summary: "過去24時間のログはありません。",
        items: [],
      };
    }

    const prompt = this.buildAnalysisPrompt(logs, stats);

    try {
      const completion = await this.glmClient.chat.completions.create({
        model: "glm-4.7",
        messages: [
          { role: "system", content: this.getSystemPrompt() },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content ?? "{}";
      return this.parseAnalysisResponse(content);
    } catch (error) {
      console.error("GLM analysis failed:", error);
      // フォールバック: 基本的な要約を返す
      return this.generateFallbackAnalysis(stats);
    }
  }

  private getSystemPrompt(): string {
    return `あなたはログ分析エキスパートです。与えられたログと統計情報を分析し、重要なインサイトを抽出してください。

以下のJSON形式で回答してください:
{
  "summary": "日本語で100-200文字程度の要約",
  "items": [
    {
      "severity": "info" | "warning" | "error",
      "category": "error" | "performance" | "usage" | "anomaly",
      "title": "短いタイトル",
      "description": "詳細な説明"
    }
  ]
}

分析ポイント:
- エラーや警告のパターン
- ツール使用の傾向
- セッション数の変化
- 異常な動作の検出`;
  }

  private buildAnalysisPrompt(logs: LogEntry[], stats: DailyStats): string {
    // 最新50件のログサンプルを取得
    const recentLogs = logs.slice(-50).map((log) => ({
      type: log.type,
      timestamp: log.timestamp,
      agentAction: log.agentAction,
      tool: log.tool,
      level: log.level,
      message: log.message,
    }));

    // Top 5 ツール使用
    const topTools = Object.entries(stats.toolUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return `## 統計情報
- 総ログ数: ${stats.totalLogs}
- エージェントログ: ${stats.agentLogs}
- プロンプトログ: ${stats.promptLogs}
- システムログ: ${stats.systemLogs}
- エラー数: ${stats.errorCount}
- 警告数: ${stats.warningCount}
- ユニークセッション数: ${stats.uniqueSessions}

## Top 5 ツール使用
${topTools.map(([tool, count]) => `- ${tool}: ${count}回`).join("\n")}

## 最新ログサンプル (50件)
${JSON.stringify(recentLogs, null, 2)}

上記の情報を分析し、重要なインサイトを抽出してください。`;
  }

  private parseAnalysisResponse(content: string): AnalysisResult {
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
            ["error", "performance", "usage", "anomaly"].includes(
              item.category,
            ),
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

  private generateFallbackAnalysis(stats: DailyStats): AnalysisResult {
    const items: ReportItem[] = [];

    // エラーがある場合
    if (stats.errorCount > 0) {
      items.push({
        severity: "error",
        category: "error",
        title: `${stats.errorCount}件のエラーを検出`,
        description: `過去24時間で${stats.errorCount}件のエラーが発生しています。ログを確認してください。`,
      });
    }

    // 警告がある場合
    if (stats.warningCount > 0) {
      items.push({
        severity: "warning",
        category: "anomaly",
        title: `${stats.warningCount}件の警告を検出`,
        description: `過去24時間で${stats.warningCount}件の警告が発生しています。`,
      });
    }

    // ツール使用統計
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
}
