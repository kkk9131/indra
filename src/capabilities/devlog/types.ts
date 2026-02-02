export interface CommitInfo {
  hash: string;
  message: string;
  type: string;
  scope?: string;
  timestamp: string;
  author: string;
  files: string[];
}

export interface DevlogEntry {
  id: string;
  date: string;
  commits: CommitInfo[];
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
    totalCommits: number;
  };
}

export interface DevlogListParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
}
