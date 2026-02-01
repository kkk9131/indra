/**
 * Reports Service
 *
 * レポートファイルの一覧取得と内容読み取りを提供
 */

import { promises as fs } from "fs";
import path from "path";

export interface ReportSummary {
  id: string;
  topic: string;
  date: string;
  path: string;
  size: number;
}

export interface ReportDetail extends ReportSummary {
  content: string;
}

const AGENT_OUTPUT_DIR = "agent-output";

export interface ReportsService {
  listReports(): Promise<ReportSummary[]>;
  getReport(id: string): Promise<ReportDetail | null>;
}

interface ReportServiceDeps {
  basePath?: string;
}

export function createReportsService(
  deps: ReportServiceDeps = {},
): ReportsService {
  const basePath = deps.basePath ?? process.cwd();
  const outputDir = path.join(basePath, AGENT_OUTPUT_DIR);

  return {
    async listReports(): Promise<ReportSummary[]> {
      const reports: ReportSummary[] = [];

      try {
        const entries = await fs.readdir(outputDir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          // research-YYYYMMDD-topic 形式のディレクトリを検索
          const match = entry.name.match(/^research-(\d{8})-(.+)$/);
          if (!match) continue;

          const [, dateStr, topic] = match;
          const reportPath = path.join(outputDir, entry.name, "report.md");

          try {
            const stat = await fs.stat(reportPath);
            reports.push({
              id: entry.name,
              topic: decodeURIComponent(topic.replace(/-/g, " ")),
              date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
              path: reportPath,
              size: stat.size,
            });
          } catch {
            // report.md が存在しない場合はスキップ
          }
        }

        // 日付順にソート（新しい順）
        reports.sort((a, b) => b.date.localeCompare(a.date));
      } catch (error) {
        // ディレクトリが存在しない場合は空配列を返す
        console.warn(
          `[ReportsService] Output directory not found: ${outputDir}`,
        );
      }

      return reports;
    },

    async getReport(id: string): Promise<ReportDetail | null> {
      // IDのサニタイズ（パストラバーサル対策）
      const sanitizedId = id.replace(
        /[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF-]/g,
        "",
      );
      if (sanitizedId !== id) {
        console.warn(`[ReportsService] Invalid report ID: ${id}`);
        return null;
      }

      const reportPath = path.join(outputDir, id, "report.md");

      try {
        const [content, stat] = await Promise.all([
          fs.readFile(reportPath, "utf-8"),
          fs.stat(reportPath),
        ]);

        const match = id.match(/^research-(\d{8})-(.+)$/);
        if (!match) return null;

        const [, dateStr, topic] = match;

        return {
          id,
          topic: decodeURIComponent(topic.replace(/-/g, " ")),
          date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
          path: reportPath,
          size: stat.size,
          content,
        };
      } catch {
        return null;
      }
    },
  };
}
