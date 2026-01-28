import type { APIEmbed } from "discord.js";
import type { DailyReport } from "./types.js";

/**
 * DailyReportからDiscord Embedを生成
 */
export function createReportEmbed(report: DailyReport): APIEmbed {
  const hasErrors = report.stats.errorCount > 0;
  const hasWarnings = report.stats.warningCount > 0;

  // 色の決定: エラーあり=赤、警告のみ=オレンジ、問題なし=緑
  let color: number;
  if (hasErrors) {
    color = 0xdc3545; // 赤
  } else if (hasWarnings) {
    color = 0xffc107; // オレンジ
  } else {
    color = 0x28a745; // 緑
  }

  // フィールド作成
  const fields: APIEmbed["fields"] = [];

  // 統計情報フィールド
  fields.push({
    name: "📊 Statistics",
    value: [
      `**Total Logs:** ${report.stats.totalLogs}`,
      `**Agent:** ${report.stats.agentLogs} | **Prompt:** ${report.stats.promptLogs} | **System:** ${report.stats.systemLogs}`,
      `**Sessions:** ${report.stats.uniqueSessions}`,
      `**Errors:** ${report.stats.errorCount} | **Warnings:** ${report.stats.warningCount}`,
    ].join("\n"),
    inline: false,
  });

  // Top Tools フィールド
  const topTools = Object.entries(report.stats.toolUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (topTools.length > 0) {
    fields.push({
      name: "🔧 Top Tools",
      value: topTools
        .map(([tool, count]) => `\`${tool}\`: ${count}`)
        .join("\n"),
      inline: true,
    });
  }

  // Issues フィールド (最大3件)
  const issues = report.items.slice(0, 3);
  if (issues.length > 0) {
    const issueText = issues
      .map((item) => {
        const icon =
          item.severity === "error"
            ? "🔴"
            : item.severity === "warning"
              ? "🟠"
              : "🔵";
        return `${icon} **${item.title}**\n${item.description}`;
      })
      .join("\n\n");

    fields.push({
      name: "⚠️ Issues",
      value: issueText.slice(0, 1024), // Discord制限
      inline: false,
    });
  }

  // Embed構築
  const embed: APIEmbed = {
    title: report.title,
    description: report.summary,
    color,
    fields,
    footer: {
      text: `Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`,
    },
    timestamp: report.generatedAt,
  };

  return embed;
}

/**
 * 日付を読みやすい形式にフォーマット
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
