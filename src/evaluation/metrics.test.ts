import { describe, it, expect } from "vitest";
import {
  binomialCoefficient,
  calculatePassAtK,
  calculatePassK,
  interpretMetrics,
} from "./metrics.js";

describe("binomialCoefficient", () => {
  it("should return 1 for C(n, 0)", () => {
    expect(binomialCoefficient(5, 0)).toBe(1);
    expect(binomialCoefficient(10, 0)).toBe(1);
  });

  it("should return 1 for C(n, n)", () => {
    expect(binomialCoefficient(5, 5)).toBe(1);
    expect(binomialCoefficient(10, 10)).toBe(1);
  });

  it("should return n for C(n, 1)", () => {
    expect(binomialCoefficient(5, 1)).toBe(5);
    expect(binomialCoefficient(10, 1)).toBe(10);
  });

  it("should calculate common values correctly", () => {
    expect(binomialCoefficient(5, 2)).toBe(10);
    expect(binomialCoefficient(6, 3)).toBe(20);
    expect(binomialCoefficient(10, 5)).toBe(252);
  });

  it("should return 0 for invalid inputs", () => {
    expect(binomialCoefficient(5, 6)).toBe(0);
    expect(binomialCoefficient(5, -1)).toBe(0);
  });
});

describe("calculatePassAtK", () => {
  it("should return 1 when all trials pass", () => {
    expect(calculatePassAtK(10, 10, 5)).toBe(1);
  });

  it("should return 0 when no trials pass", () => {
    expect(calculatePassAtK(10, 0, 5)).toBe(0);
  });

  it("should calculate correctly for partial success", () => {
    // 10 trials, 5 passed, k=5
    // Pass@5 = 1 - C(5, 5) / C(10, 5) = 1 - 1/252 ≈ 0.996
    const result = calculatePassAtK(10, 5, 5);
    expect(result).toBeGreaterThan(0.99);
    expect(result).toBeLessThan(1);
  });

  it("should handle case when n < k", () => {
    // With 3 trials and 2 passed, probability of at least 1 success
    const result = calculatePassAtK(3, 2, 5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("should return high value when most trials pass", () => {
    // 10 trials, 9 passed, k=5
    const result = calculatePassAtK(10, 9, 5);
    expect(result).toBeGreaterThan(0.99);
  });
});

describe("calculatePassK", () => {
  it("should return 1 when all trials pass and c >= k", () => {
    expect(calculatePassK(10, 10, 5)).toBe(1);
  });

  it("should return 0 when passed trials < k", () => {
    expect(calculatePassK(10, 4, 5)).toBe(0);
    expect(calculatePassK(10, 0, 5)).toBe(0);
  });

  it("should calculate correctly for partial success", () => {
    // 10 trials, 5 passed, k=5
    // Pass 5 = C(5, 5) / C(10, 5) = 1/252 ≈ 0.004
    const result = calculatePassK(10, 5, 5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.01);
  });

  it("should handle case when n < k and all pass", () => {
    const result = calculatePassK(3, 3, 5);
    expect(result).toBe(1);
  });

  it("should handle case when n < k and not all pass", () => {
    const result = calculatePassK(3, 2, 5);
    expect(result).toBe(0);
  });

  it("should return higher value when more trials pass", () => {
    // 10 trials, 8 passed vs 10 trials, 5 passed
    const result8 = calculatePassK(10, 8, 5);
    const result5 = calculatePassK(10, 5, 5);
    expect(result8).toBeGreaterThan(result5);
  });
});

describe("interpretMetrics", () => {
  it("should identify excellent performance", () => {
    const result = interpretMetrics(0.9, 0.7);
    expect(result).toContain("Excellent");
  });

  it("should identify unstable performance", () => {
    const result = interpretMetrics(0.9, 0.3);
    expect(result).toContain("unstable");
  });

  it("should identify fundamental issues", () => {
    const result = interpretMetrics(0.3, 0.1);
    expect(result).toContain("improvement");
  });

  it("should identify moderate performance", () => {
    const result = interpretMetrics(0.6, 0.4);
    expect(result).toContain("Moderate");
  });
});

describe("Pass@K vs Pass K relationship", () => {
  it("Pass@K should always be >= Pass K", () => {
    const testCases = [
      { n: 10, c: 5, k: 5 },
      { n: 10, c: 8, k: 5 },
      { n: 10, c: 2, k: 5 },
      { n: 20, c: 10, k: 5 },
    ];

    for (const { n, c, k } of testCases) {
      const passAtK = calculatePassAtK(n, c, k);
      const passK = calculatePassK(n, c, k);
      expect(passAtK).toBeGreaterThanOrEqual(passK);
    }
  });

  it("should have equal values when all pass", () => {
    const passAtK = calculatePassAtK(10, 10, 5);
    const passK = calculatePassK(10, 10, 5);
    expect(passAtK).toBe(1);
    expect(passK).toBe(1);
  });

  it("should have equal values (0) when none pass", () => {
    const passAtK = calculatePassAtK(10, 0, 5);
    const passK = calculatePassK(10, 0, 5);
    expect(passAtK).toBe(0);
    expect(passK).toBe(0);
  });
});
