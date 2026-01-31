/** レポートソースの種類 */
export type ReportSource = "indra-log" | "news-report";

/** 日次統計 */
export interface DailyStats {
  /** 総ログ数 */
  totalLogs: number;
  /** エージェントログ数 */
  agentLogs: number;
  /** プロンプトログ数 */
  promptLogs: number;
  /** システムログ数 */
  systemLogs: number;
  /** エラー数 */
  errorCount: number;
  /** 警告数 */
  warningCount: number;
  /** ツール使用回数（ツール名→回数） */
  toolUsage: Record<string, number>;
  /** ユニークセッション数 */
  uniqueSessions: number;
}

/** レポート項目 */
export interface ReportItem {
  /** 重要度 */
  severity: "info" | "warning" | "error";
  /** カテゴリ */
  category: "error" | "performance" | "usage" | "anomaly";
  /** タイトル */
  title: string;
  /** 説明 */
  description: string;
}

/** 日次レポート */
export interface DailyReport {
  /** 一意識別子 */
  id: string;
  /** ソース種別 */
  source: ReportSource;
  /** レポートタイトル */
  title: string;
  /** 要約 */
  summary: string;
  /** 統計情報 */
  stats: DailyStats;
  /** レポート項目 */
  items: ReportItem[];
  /** 分析期間開始 ISO 8601 */
  periodStart: string;
  /** 分析期間終了 ISO 8601 */
  periodEnd: string;
  /** レポート生成日時 ISO 8601 */
  generatedAt: string;
}
