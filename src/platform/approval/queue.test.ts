import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApprovalQueue } from "./queue.js";

describe("ApprovalQueue", () => {
  let baseDir = "";
  let queue: ApprovalQueue;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "indra-approval-"));
    queue = new ApprovalQueue(baseDir);
  });

  afterEach(async () => {
    if (baseDir) {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("lists failed items", () => {
    const item = queue.create({
      platform: "x",
      content: { text: "hello" },
    });

    queue.markFailed(item.id, "boom");

    const failed = queue.list("failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].status).toBe("failed");
  });

  it("does not duplicate history items", () => {
    const rejected = queue.create({
      platform: "x",
      content: { text: "reject me" },
    });
    queue.reject(rejected.id);

    const posted = queue.create({
      platform: "x",
      content: { text: "post me" },
    });
    queue.markPosted(posted.id, "post-1", "https://x.com/i/status/post-1");

    const items = queue.list();
    expect(items).toHaveLength(2);

    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
