import { createHash } from "node:crypto";

import type { GitHubChangelogConfig, NewsArticle } from "./types.js";

const VERSION_REGEX = /^## \[?v?(\d+\.\d+\.\d+[^\]\n]*)\]?/gm;

export interface ChangelogEntry {
  version: string;
  content: string;
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const matches = [...markdown.matchAll(VERSION_REGEX)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];
    const startIndex = match.index! + match[0].length;
    const endIndex = matches[i + 1]?.index ?? markdown.length;

    const content = markdown.slice(startIndex, endIndex).trim();

    if (content) {
      entries.push({ version, content });
    }
  }

  return entries;
}

export function changelogEntryToArticle(
  entry: ChangelogEntry,
  config: GitHubChangelogConfig,
): NewsArticle {
  const { owner, repo, branch = "main", filePath = "CHANGELOG.md" } = config;
  const contentHash = `github-changelog-${owner}-${repo}-${entry.version}`;
  const id = createHash("sha256")
    .update(contentHash)
    .digest("hex")
    .slice(0, 16);

  return {
    id,
    source: "github-changelog",
    title: `Claude Code v${entry.version}`,
    titleJa: null,
    summary: null,
    url: `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
    publishedAt: null,
    fetchedAt: new Date().toISOString(),
    contentHash,
    body: entry.content,
    bodyJa: null,
    imageUrl: null,
  };
}

export async function fetchGitHubChangelog(
  config: GitHubChangelogConfig,
): Promise<NewsArticle[]> {
  const { owner, repo, branch = "main", filePath = "CHANGELOG.md" } = config;

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

  const response = await fetch(rawUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch changelog: ${response.status} ${response.statusText}`,
    );
  }

  const markdown = await response.text();
  const entries = parseChangelog(markdown);

  return entries.map((entry) => changelogEntryToArticle(entry, config));
}
