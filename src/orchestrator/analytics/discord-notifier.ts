import type { APIEmbed } from "discord.js";
import type { DailyReport } from "./types.js";
import type { NewsReport } from "./news-report-scheduler.js";
import type { NotificationData } from "../../channels/discord/types.js";

export interface ResearchReport {
  id: string;
  topic: string;
  outputPath: string;
  generatedAt: string;
  summary?: string;
  keyPoints?: string[];
  webUiUrl?: string;
}

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

/**
 * NewsReportからDiscord Embedを生成
 */
export function createNewsReportEmbed(report: NewsReport): APIEmbed {
  // 色は常にブルー系（情報提供）
  const color = 0x3498db;

  const fields: APIEmbed["fields"] = [];

  // Top 3 アイテムをフィールドとして追加
  for (const item of report.topItems) {
    const icon = item.type === "news" ? "📰" : "🐦";
    const scoreBar =
      "█".repeat(Math.floor(item.score / 10)) +
      "░".repeat(10 - Math.floor(item.score / 10));

    fields.push({
      name: `${item.rank}. ${icon} ${item.title.substring(0, 50)}`,
      value: [
        `**スコア:** ${item.score.toFixed(1)} [${scoreBar}]`,
        `**重要度:** ${item.importance} | **新規性:** ${item.novelty} | **影響度:** ${item.impact}`,
        `📝 ${item.reason}`,
      ].join("\n"),
      inline: false,
    });
  }

  // レポートが空の場合
  if (report.topItems.length === 0) {
    fields.push({
      name: "📭 No Items",
      value: "評価対象のニュース・投稿がありませんでした。",
      inline: false,
    });
  }

  const embed: APIEmbed = {
    title: `📊 ${report.title}`,
    description: report.summary.substring(0, 2000),
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
 * 通知用のDiscord Embedを生成
 */
export function createNotificationEmbed(data: NotificationData): APIEmbed {
  let color: number;
  let icon: string;

  switch (data.type) {
    case "approval_pending":
      color = 0x3498db; // 青
      icon = "📝";
      break;
    case "task_executed":
      color = 0x28a745; // 緑
      icon = "✅";
      break;
    case "error":
      color = 0xdc3545; // 赤
      icon = "❌";
      break;
  }

  const fields: APIEmbed["fields"] = [];

  if (data.platform) {
    fields.push({ name: "Platform", value: data.platform, inline: true });
  }
  if (data.itemId) {
    fields.push({ name: "ID", value: data.itemId, inline: true });
  }
  if (data.content) {
    fields.push({
      name: "Content",
      value: data.content.slice(0, 1024),
      inline: false,
    });
  }
  if (data.error) {
    fields.push({ name: "Error", value: data.error, inline: false });
  }

  return {
    title: `${icon} ${data.title}`,
    description: data.description,
    color,
    fields: fields.length > 0 ? fields : undefined,
    timestamp: new Date().toISOString(),
  };
}

export function createResearchReportEmbed(report: ResearchReport): APIEmbed {
  const description = report.summary ?? `**トピック:** ${report.topic}`;

  const fields: APIEmbed["fields"] = [
    {
      name: "📁 出力先",
      value: `\`${report.outputPath}\``,
      inline: false,
    },
  ];

  if (report.keyPoints && report.keyPoints.length > 0) {
    const keyPointsText = report.keyPoints
      .slice(0, 5)
      .map((point) => `• ${point}`)
      .join("\n");
    fields.push({
      name: "📝 キーポイント",
      value: keyPointsText.slice(0, 1024),
      inline: false,
    });
  }

  if (report.webUiUrl) {
    fields.push({
      name: "🔗 詳細",
      value: `[Web UIで閲覧](${report.webUiUrl})`,
      inline: false,
    });
  }

  return {
    title: "📚 リサーチレポート完成",
    description,
    color: 0x9b59b6,
    fields,
    footer: { text: "Research Report" },
    timestamp: report.generatedAt,
  };
}
