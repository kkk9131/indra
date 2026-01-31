import type { LogEntry } from "../../platform/logs/types.js";
import type { DailyStats } from "./types.js";

/**
 * ログ統計計算ユーティリティ
 *
 * GLM分析は .claude/skills/glm-analyze/ に移行済み
 */
export class LogAnalyzer {
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
}

/**
 * スタンドアロンで使用可能なcalculateStats関数
 */
export function calculateStats(logs: LogEntry[]): DailyStats {
  const analyzer = new LogAnalyzer();
  return analyzer.calculateStats(logs);
}
