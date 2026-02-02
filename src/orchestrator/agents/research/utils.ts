import { promises as fs } from "fs";

export interface ReportSummaryInfo {
  summary: string;
  keyPoints: string[];
}

export async function extractReportSummary(
  reportPath: string,
): Promise<ReportSummaryInfo | null> {
  try {
    const content = await fs.readFile(reportPath, "utf-8");
    return parseReportContent(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseReportContent(content: string): ReportSummaryInfo {
  const summaryHeaders = ["## エグゼクティブサマリー", "## Executive Summary"];
  const keyPointHeaders = ["## キーポイント", "## Key Points"];

  return {
    summary: extractSection(content, summaryHeaders),
    keyPoints: extractKeyPoints(content, keyPointHeaders),
  };
}

function extractSection(content: string, sectionHeaders: string[]): string {
  for (const header of sectionHeaders) {
    const headerIndex = content.indexOf(header);
    if (headerIndex === -1) continue;

    const startIndex = content.indexOf("\n", headerIndex);
    if (startIndex === -1) continue;

    const endIndex = findNextSection(content, startIndex + 1);
    const sectionContent = content.slice(startIndex + 1, endIndex).trim();

    return extractFirstParagraph(sectionContent);
  }

  return "";
}

function extractFirstParagraph(content: string): string {
  const lines = content.split("\n");
  const paragraphLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "---") continue;
    if (trimmed === "" && paragraphLines.length > 0) break;
    if (line.startsWith("##")) break;

    const isBullet = trimmed.startsWith("-") || trimmed.startsWith("*");
    const isBoldHeading = trimmed.startsWith("**") && trimmed.endsWith("**");

    if (isBullet || isBoldHeading) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    if (trimmed) {
      paragraphLines.push(trimmed);
    }
  }

  return paragraphLines.join(" ");
}

function extractKeyPoints(content: string, sectionHeaders: string[]): string[] {
  for (const header of sectionHeaders) {
    const headerIndex = content.indexOf(header);
    if (headerIndex === -1) continue;

    const startIndex = content.indexOf("\n", headerIndex);
    if (startIndex === -1) continue;

    const endIndex = findNextSection(content, startIndex + 1);
    const sectionContent = content.slice(startIndex + 1, endIndex);

    return extractBulletPoints(sectionContent);
  }

  return [];
}

function findNextSection(content: string, startFrom: number): number {
  const lines = content.slice(startFrom).split("\n");
  let currentIndex = startFrom;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      return currentIndex;
    }
    currentIndex += line.length + 1;
  }

  return content.length;
}

function extractBulletPoints(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("*"))
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
