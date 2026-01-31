import { describe, expect, it, afterAll, beforeAll } from "vitest";
import {
  browserOpen,
  browserSnapshot,
  browserGet,
  browserClose,
  browserScreenshot,
} from "./browser.js";

const shouldRun = process.env.AGENT_BROWSER_TESTS === "true";
const describeBrowser = shouldRun ? describe : describe.skip;

describeBrowser("browser tools", () => {
  beforeAll(() => {
    const openResult = browserOpen("https://example.com", { session: "test" });
    if (!openResult.success) {
      throw new Error(
        openResult.error ??
          "agent-browser is not available (set AGENT_BROWSER_TESTS=true to run)",
      );
    }
  });

  afterAll(() => {
    browserClose({ session: "test" });
  });

  it("should open a URL and get page info", () => {
    const openResult = browserOpen("https://example.com", { session: "test" });
    expect(openResult.success).toBe(true);

    const urlResult = browserGet("url", undefined, { session: "test" });
    expect(urlResult.success).toBe(true);
    expect(urlResult.output).toContain("example.com");

    const titleResult = browserGet("title", undefined, { session: "test" });
    expect(titleResult.success).toBe(true);
    expect(titleResult.output).toContain("Example Domain");
  });

  it("should take a snapshot for AI", () => {
    browserOpen("https://example.com", { session: "test" });

    const snapshotResult = browserSnapshot({
      session: "test",
      interactive: true,
      compact: true,
    });
    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.output).toBeTruthy();
  });

  it("should take a screenshot", () => {
    browserOpen("https://example.com", { session: "test" });

    const result = browserScreenshot({
      session: "test",
      path: "/tmp/test-screenshot.png",
    });
    expect(result.success).toBe(true);
  });
});
