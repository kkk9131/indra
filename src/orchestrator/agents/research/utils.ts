/**
 * レポートMarkdownファイルからサマリーとキーポイントを抽出するユーティリティ
 */

import { promises as fs } from "fs";

/**
 * レポートサマリー情報
 */
export interface ReportSummaryInfo {
  /** エグゼクティブサマリー（最初の段落） */
  summary: string;
  /** キーポイント（箇条書き） */
  keyPoints: string[];
}

/**
 * レポートMarkdownからサマリー情報を抽出
 *
 * @param reportPath - レポートファイルのパス
 * @returns サマリー情報、ファイルが存在しない場合はnull
 */
export async function extractReportSummary(
  reportPath: string,
): Promise<ReportSummaryInfo | null> {
  try {
    const content = await fs.readFile(reportPath, "utf-8");
    return parseReportContent(content);
  } catch (error) {
    // ファイルが存在しない場合はnullを返す
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * レポートコンテンツをパースしてサマリー情報を抽出
 */
function parseReportContent(content: string): ReportSummaryInfo {
  const summary = extractSection(content, [
    "## エグゼクティブサマリー",
    "## Executive Summary",
  ]);
  const keyPoints = extractKeyPoints(content, [
    "## キーポイント",
    "## Key Points",
  ]);

  return { summary, keyPoints };
}

/**
 * 指定されたセクションのコンテンツを抽出
 */
function extractSection(content: string, sectionHeaders: string[]): string {
  for (const header of sectionHeaders) {
    const headerIndex = content.indexOf(header);
    if (headerIndex === -1) continue;

    // ヘッダー行の終わりを探す
    const startIndex = content.indexOf("\n", headerIndex);
    if (startIndex === -1) continue;

    // 次のセクション（## で始まる行）を探す
    const endIndex = findNextSection(content, startIndex + 1);

    const sectionContent = content.slice(startIndex + 1, endIndex).trim();

    // 最初の段落を取得（空行で区切られた最初のブロック）
    return extractFirstParagraph(sectionContent);
  }

  return "";
}

/**
 * 最初の段落を抽出（空行で区切られた最初のブロック）
 */
function extractFirstParagraph(content: string): string {
  // 区切り線（---）を除外
  const lines = content.split("\n");
  const paragraphLines: string[] = [];

  for (const line of lines) {
    // 区切り線はスキップ
    if (line.trim() === "---") continue;

    // 空行または次のセクションで終了
    if (line.trim() === "" && paragraphLines.length > 0) break;
    if (line.startsWith("##")) break;

    // 箇条書きは除外（キーポイント用）
    if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    // 太字見出しは除外（**主要な発見:**など）
    if (line.trim().startsWith("**") && line.trim().endsWith("**")) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    if (line.trim()) {
      paragraphLines.push(line.trim());
    }
  }

  return paragraphLines.join(" ");
}

/**
 * キーポイント（箇条書き）を抽出
 */
function extractKeyPoints(content: string, sectionHeaders: string[]): string[] {
  for (const header of sectionHeaders) {
    const headerIndex = content.indexOf(header);
    if (headerIndex === -1) continue;

    // ヘッダー行の終わりを探す
    const startIndex = content.indexOf("\n", headerIndex);
    if (startIndex === -1) continue;

    // 次のセクション（## で始まる行）を探す
    const endIndex = findNextSection(content, startIndex + 1);

    const sectionContent = content.slice(startIndex + 1, endIndex);
    return extractBulletPoints(sectionContent);
  }

  return [];
}

/**
 * 次のセクション（## で始まる行）のインデックスを探す
 */
function findNextSection(content: string, startFrom: number): number {
  const lines = content.slice(startFrom).split("\n");
  let currentIndex = startFrom;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      return currentIndex;
    }
    currentIndex += line.length + 1; // +1 for newline
  }

  return content.length;
}

/**
 * 箇条書き（- または *）を配列として抽出
 */
function extractBulletPoints(content: string): string[] {
  const lines = content.split("\n");
  const points: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // - または * で始まる行を抽出
    if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
      // 先頭の - または * とスペースを除去
      const point = trimmed.replace(/^[-*]\s*/, "").trim();
      if (point) {
        points.push(point);
      }
    }
  }

  return points;
}
