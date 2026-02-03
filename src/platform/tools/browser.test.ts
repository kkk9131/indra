import { describe, expect, it, beforeEach, vi } from "vitest";

const execSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  execSync: execSyncMock,
}));

describe("browser tools", () => {
  let browserOpen: typeof import("./browser.js").browserOpen;
  let browserSnapshot: typeof import("./browser.js").browserSnapshot;
  let browserGet: typeof import("./browser.js").browserGet;
  let browserClose: typeof import("./browser.js").browserClose;
  let browserScreenshot: typeof import("./browser.js").browserScreenshot;

  beforeEach(async () => {
    execSyncMock.mockReset();
    process.env.AGENT_BROWSER_PATH = "/tmp/agent-browser";

    const browser = await import("./browser.js");
    browserOpen = browser.browserOpen;
    browserSnapshot = browser.browserSnapshot;
    browserGet = browser.browserGet;
    browserClose = browser.browserClose;
    browserScreenshot = browser.browserScreenshot;
  });

  it("should open a URL and get page info", () => {
    execSyncMock
      .mockReturnValueOnce("ok")
      .mockReturnValueOnce("https://example.com")
      .mockReturnValueOnce("Example Domain");

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
    execSyncMock.mockReturnValueOnce("snapshot");

    const snapshotResult = browserSnapshot({
      session: "test",
      interactive: true,
      compact: true,
    });
    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.output).toBe("snapshot");
  });

  it("should take a screenshot", () => {
    execSyncMock.mockReturnValueOnce("ok");

    const result = browserScreenshot({
      session: "test",
      path: "/tmp/test-screenshot.png",
    });
    expect(result.success).toBe(true);
  });

  it("returns stderr when command fails", () => {
    const error = Object.assign(new Error("boom"), { stderr: "stderr boom" });
    execSyncMock.mockImplementationOnce(() => {
      throw error;
    });

    const result = browserClose({ session: "test" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("stderr boom");
  });
});
