import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { CommitInfo, DevlogEntry, DevlogListParams } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../../..");

function parseCommitMessage(message: string): {
  type: string;
  scope?: string;
  description: string;
} {
  const match = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (match) {
    return { type: match[1], scope: match[2], description: match[3] };
  }
  return { type: "other", description: message };
}

function execGit(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", cwd: PROJECT_ROOT }).trim();
  } catch {
    return "";
  }
}

function buildDateArgs(startDate?: string, endDate?: string): string {
  const args: string[] = [];
  if (startDate) args.push(`--since="${startDate} 00:00:00"`);
  if (endDate) args.push(`--until="${endDate} 23:59:59"`);
  return args.join(" ");
}

function collectUniqueFiles(commits: CommitInfo[]): Set<string> {
  const files = new Set<string>();
  for (const commit of commits) {
    for (const file of commit.files) {
      files.add(file);
    }
  }
  return files;
}

function getCommits(startDate?: string, endDate?: string): CommitInfo[] {
  const dateArgs = buildDateArgs(startDate, endDate);
  const logOutput = execGit(`git log --format="%H|%s|%an|%aI" ${dateArgs}`);

  if (!logOutput) return [];

  const commits: CommitInfo[] = [];

  for (const line of logOutput.split("\n")) {
    const [hash, message, author, timestamp] = line.split("|");
    if (!hash || !message) continue;

    const filesOutput = execGit(`git show --name-only --format="" ${hash}`);
    const files = filesOutput
      ? filesOutput.split("\n").filter((f) => f.trim())
      : [];

    const parsed = parseCommitMessage(message);

    commits.push({
      hash,
      message,
      type: parsed.type,
      scope: parsed.scope,
      timestamp,
      author,
      files,
    });
  }

  return commits;
}

function getStats(
  startDate?: string,
  endDate?: string,
): { insertions: number; deletions: number } {
  const dateArgs = buildDateArgs(startDate, endDate);
  const statOutput = execGit(`git log --stat --oneline ${dateArgs}`);

  let insertions = 0;
  let deletions = 0;

  const matches = Array.from(
    statOutput.matchAll(/(\d+) insertions?\(\+\)|(\d+) deletions?\(-\)/g),
  );
  for (const match of matches) {
    if (match[1]) insertions += parseInt(match[1], 10);
    if (match[2]) deletions += parseInt(match[2], 10);
  }

  return { insertions, deletions };
}

function groupCommitsByDate(commits: CommitInfo[]): Map<string, CommitInfo[]> {
  const groups = new Map<string, CommitInfo[]>();

  for (const commit of commits) {
    const date = commit.timestamp.split("T")[0];
    const existing = groups.get(date) ?? [];
    existing.push(commit);
    groups.set(date, existing);
  }

  return groups;
}

function buildDevlogEntry(date: string, commits: CommitInfo[]): DevlogEntry {
  const dayStats = getStats(date, date);
  return {
    id: `devlog-${date}`,
    date,
    commits,
    stats: {
      filesChanged: collectUniqueFiles(commits).size,
      insertions: dayStats.insertions,
      deletions: dayStats.deletions,
      totalCommits: commits.length,
    },
  };
}

export function listDevlogs(params?: DevlogListParams): DevlogEntry[] {
  try {
    const { startDate, endDate, limit = 30 } = params ?? {};

    const commits = getCommits(startDate, endDate);
    if (commits.length === 0) return [];

    const grouped = groupCommitsByDate(commits);
    const sortedDates = Array.from(grouped.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    return sortedDates
      .slice(0, limit)
      .map((date) => buildDevlogEntry(date, grouped.get(date)!));
  } catch {
    return [];
  }
}

export function getDevlogStats(date: string): DevlogEntry["stats"] {
  try {
    const commits = getCommits(date, date);
    const dayStats = getStats(date, date);

    return {
      filesChanged: collectUniqueFiles(commits).size,
      insertions: dayStats.insertions,
      deletions: dayStats.deletions,
      totalCommits: commits.length,
    };
  } catch {
    return { filesChanged: 0, insertions: 0, deletions: 0, totalCommits: 0 };
  }
}
