/**
 * X運用ドメイン固有の型定義
 *
 * チェックポイント、投稿、評価結果の型。
 */

export interface XPostCheckpoint {
  articleId: string;
  phase:
    | "analyzing"
    | "generating"
    | "evaluating"
    | "refining"
    | "selecting"
    | "pending_approval"
    | "completed";
  generatedPosts?: GeneratedPost[];
  bestPostId?: string;
  publishedPostIds?: string[];
  refinementCount: number;
}

export interface GeneratedPost {
  id: string;
  text: string;
  charCount?: number;
  templateUsed?: string;
  score?: number;
  evaluationResult?: PostEvaluationResult;
}

export interface PostEvaluationResult {
  totalScore: number;
  replyScore: number;
  engagementScore: number;
  dwellTimeScore: number;
  qualityScore: number;
  suggestions: string[];
}
