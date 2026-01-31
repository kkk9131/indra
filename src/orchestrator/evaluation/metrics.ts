import type { EvaluationMetrics, Trial } from "./types.js";
import type { EvaluationStore } from "./store.js";

/**
 * Default K value for Pass@K and Pass K calculations
 */
export const DEFAULT_K = 5;

/**
 * Calculate binomial coefficient C(n, k) = n! / (k! * (n-k)!)
 * Uses multiplicative formula to avoid overflow
 */
export function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  // Use symmetry: C(n, k) = C(n, n-k)
  if (k > n - k) {
    k = n - k;
  }

  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }

  return Math.round(result);
}

/**
 * Calculate Pass@K metric
 *
 * Pass@K = 1 - C(n-c, k) / C(n, k)
 *
 * Where:
 * - n = total number of trials
 * - c = number of successful trials
 * - k = number of samples
 *
 * This metric measures the probability of getting at least one success
 * when sampling k trials from n total trials.
 *
 * Use case: Tasks where retrying is acceptable (chat, content generation)
 *
 * @param n Total number of trials
 * @param c Number of successful trials
 * @param k Sample size (default: 5)
 * @returns Pass@K probability (0-1)
 */
export function calculatePassAtK(
  n: number,
  c: number,
  k: number = DEFAULT_K,
): number {
  if (n < k) {
    // Not enough samples, use all available
    return c > 0 ? 1 - Math.pow((n - c) / n, n) : 0;
  }

  if (c >= n) return 1; // All passed
  if (c === 0) return 0; // None passed

  const numerator = binomialCoefficient(n - c, k);
  const denominator = binomialCoefficient(n, k);

  if (denominator === 0) return 0;

  return 1 - numerator / denominator;
}

/**
 * Calculate Pass K metric
 *
 * Pass K = C(c, k) / C(n, k)
 *
 * Where:
 * - n = total number of trials
 * - c = number of successful trials
 * - k = number of samples
 *
 * This metric measures the probability of getting all k successes
 * when sampling k trials from n total trials.
 *
 * Use case: Tasks where reliability is critical (automation, payments)
 *
 * @param n Total number of trials
 * @param c Number of successful trials
 * @param k Sample size (default: 5)
 * @returns Pass K probability (0-1)
 */
export function calculatePassK(
  n: number,
  c: number,
  k: number = DEFAULT_K,
): number {
  if (n < k) {
    // Not enough samples, check if all available passed
    return c === n && n > 0 ? 1 : 0;
  }

  if (c < k) return 0; // Not enough successes

  const numerator = binomialCoefficient(c, k);
  const denominator = binomialCoefficient(n, k);

  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Calculate evaluation metrics for a task
 *
 * @param store EvaluationStore instance
 * @param taskId Task ID
 * @param k Sample size for Pass@K and Pass K (default: 5)
 * @returns EvaluationMetrics object
 */
export function calculateMetrics(
  store: EvaluationStore,
  taskId: string,
  k: number = DEFAULT_K,
): EvaluationMetrics {
  const stats = store.getTaskTrialStats(taskId);
  const avgScore = store.getAverageScore(taskId);
  const avgDuration = store.getAverageDuration(taskId);

  const passAtK = calculatePassAtK(stats.total, stats.passed, k);
  const passK = calculatePassK(stats.total, stats.passed, k);

  return {
    taskId,
    totalTrials: stats.total,
    passedTrials: stats.passed,
    passAtK,
    passK,
    k,
    averageScore: avgScore,
    averageDuration: avgDuration,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate metrics from a list of trials
 * Useful for in-memory calculations without database access
 *
 * @param trials List of trials
 * @param k Sample size (default: 5)
 * @returns Partial metrics (without taskId and averageScore)
 */
export function calculateMetricsFromTrials(
  trials: Trial[],
  k: number = DEFAULT_K,
): {
  totalTrials: number;
  passedTrials: number;
  passAtK: number;
  passK: number;
  k: number;
  averageDuration: number | null;
} {
  const totalTrials = trials.length;
  const passedTrials = trials.filter((t) => t.passed).length;

  const passAtK = calculatePassAtK(totalTrials, passedTrials, k);
  const passK = calculatePassK(totalTrials, passedTrials, k);

  const durationsWithValue = trials
    .map((t) => t.duration)
    .filter((d): d is number => d !== null && d !== undefined);
  const averageDuration =
    durationsWithValue.length > 0
      ? durationsWithValue.reduce((a, b) => a + b, 0) /
        durationsWithValue.length
      : null;

  return {
    totalTrials,
    passedTrials,
    passAtK,
    passK,
    k,
    averageDuration,
  };
}

/**
 * Interpret Pass@K and Pass K results
 *
 * @param passAtK Pass@K value (0-1)
 * @param passK Pass K value (0-1)
 * @returns Interpretation string
 */
export function interpretMetrics(passAtK: number, passK: number): string {
  // High Pass@K, Low Pass K = Has potential but unstable
  if (passAtK >= 0.8 && passK < 0.6) {
    return "High potential but unstable - succeeds sometimes but not reliably";
  }

  // High Pass@K, High Pass K = Excellent
  if (passAtK >= 0.8 && passK >= 0.6) {
    return "Excellent - reliable and consistent performance";
  }

  // Low Pass@K = Fundamental issues
  if (passAtK < 0.5) {
    return "Needs improvement - fundamental capability issues";
  }

  // Medium Pass@K = Room for improvement
  if (passAtK >= 0.5 && passAtK < 0.8) {
    return "Moderate - has potential but needs tuning";
  }

  return "Results require further analysis";
}

/**
 * Format metrics for display
 *
 * @param metrics EvaluationMetrics object
 * @returns Formatted string
 */
export function formatMetrics(metrics: EvaluationMetrics): string {
  const lines = [
    `Task: ${metrics.taskId}`,
    `Trials: ${metrics.passedTrials}/${metrics.totalTrials} passed`,
    `Pass@${metrics.k}: ${(metrics.passAtK * 100).toFixed(1)}%`,
    `Pass ${metrics.k}: ${(metrics.passK * 100).toFixed(1)}%`,
    `Average Score: ${metrics.averageScore.toFixed(1)}`,
  ];

  if (
    metrics.averageDuration !== null &&
    metrics.averageDuration !== undefined
  ) {
    lines.push(`Average Duration: ${metrics.averageDuration.toFixed(0)}ms`);
  }

  lines.push(
    `Interpretation: ${interpretMetrics(metrics.passAtK, metrics.passK)}`,
  );

  return lines.join("\n");
}
