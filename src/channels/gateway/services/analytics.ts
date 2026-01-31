import type { AnalyticsScheduler } from "../../../orchestrator/analytics/index.js";

export type AnalyticsRunResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export interface AnalyticsService {
  runNow: () => AnalyticsRunResult;
}

interface AnalyticsServiceDeps {
  analyticsScheduler: AnalyticsScheduler | null;
}

export function createAnalyticsService(
  deps: AnalyticsServiceDeps,
): AnalyticsService {
  return {
    runNow() {
      if (!deps.analyticsScheduler) {
        return {
          ok: false,
          code: "ANALYTICS_NOT_CONFIGURED",
          message:
            "Analytics not configured. Set ZAI_API_KEY environment variable.",
        };
      }

      deps.analyticsScheduler.run().catch((error) => {
        console.error("[Gateway] Analytics run failed:", error);
      });

      return { ok: true };
    },
  };
}
