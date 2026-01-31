/**
 * X Post Workflow Types
 */

export type XPostWorkflowStage =
  | "started"
  | "content_fetching"
  | "template_selecting"
  | "composing"
  | "evaluating"
  | "refining"
  | "completed"
  | "failed";

export interface XPostProgressEvent {
  stage: XPostWorkflowStage;
  message: string;
  progress: number; // 0-100
}

export interface GeneratedPost {
  id: string;
  text: string;
  charCount: number;
  score?: number;
  templateUsed: string;
  evaluation?: PostEvaluation;
}

export interface PostEvaluation {
  overallScore: number;
  replyPotential: number;
  engagementPotential: number;
  dwellTimePotential: number;
  contentQuality: number;
  feedback: string;
}

export interface XPostWorkflowOptions {
  targetScore?: number; // Default: 70
  maxRetries?: number; // Default: 3
}

export interface XPostWorkflowResult {
  success: boolean;
  articleId: string;
  bestPost?: GeneratedPost;
  allPosts?: GeneratedPost[];
  error?: string;
  processingTime: number;
}
