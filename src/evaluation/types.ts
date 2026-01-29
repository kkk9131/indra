import { z } from "zod";

/**
 * Task types that can be evaluated
 * - xpost: X/Twitter post generation
 * - report: Report generation
 * - chat: Conversational responses
 * - browser: Web automation tasks
 * - other: Other tasks
 */
export type TaskType = "xpost" | "report" | "chat" | "browser" | "other";

/**
 * Task definition for evaluation
 */
export interface Task {
  id: string;
  name: string;
  taskType: TaskType;
  input: string;
  successCriteria: string;
  /** Whether this task should fail (safety test) */
  shouldFail?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  taskType: z.enum(["xpost", "report", "chat", "browser", "other"]),
  input: z.string(),
  successCriteria: z.string(),
  shouldFail: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Trial represents a single execution attempt of a task
 */
export interface Trial {
  id: string;
  taskId: string;
  trialNumber: number;
  /** Reference to execution log */
  executionId?: string | null;
  /** Reference to session */
  sessionId?: string | null;
  /** Reference to outcome log */
  outcomeId?: string | null;
  /** Whether this trial passed */
  passed: boolean;
  /** Execution duration in ms */
  duration?: number | null;
  createdAt: string;
}

export const TrialSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  trialNumber: z.number(),
  executionId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  outcomeId: z.string().nullable().optional(),
  passed: z.boolean(),
  duration: z.number().nullable().optional(),
  createdAt: z.string(),
});

/**
 * Grader types
 * - glm: GLM (Z.ai) model-based grading
 * - claude: Claude model-based grading
 * - code: Rule-based code grading
 */
export type GraderType = "glm" | "claude" | "code";

/**
 * Grader result for a single trial
 */
export interface GraderResult {
  id: string;
  trialId: string;
  graderType: GraderType;
  graderName: string;
  passed: boolean;
  score: number;
  reason: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export const GraderResultSchema = z.object({
  id: z.string(),
  trialId: z.string(),
  graderType: z.enum(["glm", "claude", "code"]),
  graderName: z.string(),
  passed: z.boolean(),
  score: z.number(),
  reason: z.string(),
  details: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string(),
});

/**
 * Evaluation metrics for a task
 */
export interface EvaluationMetrics {
  taskId: string;
  totalTrials: number;
  passedTrials: number;
  /** Pass@K: probability of at least 1 success in K trials */
  passAtK: number;
  /** Pass K: probability of all K trials succeeding */
  passK: number;
  /** K value used for calculation */
  k: number;
  /** Average score across all trials */
  averageScore: number;
  /** Average duration in ms */
  averageDuration?: number | null;
  calculatedAt: string;
}

export const EvaluationMetricsSchema = z.object({
  taskId: z.string(),
  totalTrials: z.number(),
  passedTrials: z.number(),
  passAtK: z.number(),
  passK: z.number(),
  k: z.number(),
  averageScore: z.number(),
  averageDuration: z.number().nullable().optional(),
  calculatedAt: z.string(),
});

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  name: string;
  taskType: TaskType;
  input: string;
  successCriteria: string;
  shouldFail?: boolean;
}

export const CreateTaskInputSchema = z.object({
  name: z.string().min(1),
  taskType: z.enum(["xpost", "report", "chat", "browser", "other"]),
  input: z.string().min(1),
  successCriteria: z.string().min(1),
  shouldFail: z.boolean().optional(),
});

/**
 * Input for creating a new trial
 */
export interface CreateTrialInput {
  taskId: string;
  executionId?: string;
  sessionId?: string;
  outcomeId?: string;
}

export const CreateTrialInputSchema = z.object({
  taskId: z.string(),
  executionId: z.string().optional(),
  sessionId: z.string().optional(),
  outcomeId: z.string().optional(),
});

/**
 * Input for recording a grader result
 */
export interface RecordGraderResultInput {
  trialId: string;
  graderType: GraderType;
  graderName: string;
  passed: boolean;
  score: number;
  reason: string;
  details?: Record<string, unknown>;
}

export const RecordGraderResultInputSchema = z.object({
  trialId: z.string(),
  graderType: z.enum(["glm", "claude", "code"]),
  graderName: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  reason: z.string(),
  details: z.record(z.unknown()).optional(),
});

/**
 * GLM grading response format
 */
export interface GLMGradingResponse {
  passed: boolean;
  score: number;
  reason: string;
  details?: Record<string, boolean>;
}

export const GLMGradingResponseSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  reason: z.string(),
  details: z.record(z.boolean()).optional(),
});

/**
 * Task with its evaluation metrics
 */
export interface TaskWithMetrics extends Task {
  metrics?: EvaluationMetrics | null;
}

/**
 * Trial with its grader results
 */
export interface TrialWithResults extends Trial {
  graderResults: GraderResult[];
}
