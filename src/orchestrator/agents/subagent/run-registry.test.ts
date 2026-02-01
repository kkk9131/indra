import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RunRegistry } from "./run-registry.js";
import { CheckpointStore } from "./checkpoint.js";

describe("RunRegistry", () => {
  let registry: RunRegistry;
  let mockStore: CheckpointStore;

  beforeEach(() => {
    // モックストア
    mockStore = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(null),
      listAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as CheckpointStore;

    registry = new RunRegistry(mockStore);
  });

  afterEach(() => {
    registry.clear();
  });

  describe("start", () => {
    it("新しい実行を作成してrunning状態にする", async () => {
      const run = await registry.start("test-agent", { foo: "bar" });

      expect(run.id).toMatch(/^run_\d+_[a-z0-9]+$/);
      expect(run.agentName).toBe("test-agent");
      expect(run.status).toBe("running");
      expect(run.inputDigest).toHaveLength(16);
      expect(run.toolCalls).toEqual([]);
      expect(run.checkpoint).toEqual({});
      expect(run.createdAt).toBeInstanceOf(Date);
      expect(run.startedAt).toBeInstanceOf(Date);
      expect(mockStore.save).toHaveBeenCalledWith(run);
    });

    it("同じ入力で同じダイジェストを生成する", async () => {
      const run1 = await registry.start("test-agent", { foo: "bar" });
      const run2 = await registry.start("test-agent", { foo: "bar" });

      expect(run1.inputDigest).toBe(run2.inputDigest);
    });

    it("異なる入力で異なるダイジェストを生成する", async () => {
      const run1 = await registry.start("test-agent", { foo: "bar" });
      const run2 = await registry.start("test-agent", { foo: "baz" });

      expect(run1.inputDigest).not.toBe(run2.inputDigest);
    });
  });

  describe("recordToolCall", () => {
    it("ツール実行を記録する", async () => {
      const run = await registry.start("test-agent", {});
      await registry.recordToolCall(
        run.id,
        "test-tool",
        { input: 1 },
        { output: 2 },
      );

      const updated = registry.get(run.id);
      expect(updated?.toolCalls).toHaveLength(1);
      expect(updated?.toolCalls[0]).toMatchObject({
        tool: "test-tool",
        input: { input: 1 },
        output: { output: 2 },
      });
      expect(updated?.toolCalls[0].timestamp).toBeInstanceOf(Date);
    });

    it("存在しないrunIdでエラーを投げる", async () => {
      await expect(
        registry.recordToolCall("non-existent", "tool", {}, {}),
      ).rejects.toThrow("Run not found: non-existent");
    });
  });

  describe("updateCheckpoint", () => {
    it("チェックポイントをマージする", async () => {
      const run = await registry.start("test-agent", {});
      await registry.updateCheckpoint(run.id, { phase: "analyzing" });
      await registry.updateCheckpoint(run.id, { count: 1 });

      const updated = registry.get(run.id);
      expect(updated?.checkpoint).toEqual({ phase: "analyzing", count: 1 });
    });
  });

  describe("complete", () => {
    it("完了状態に更新する", async () => {
      const run = await registry.start("test-agent", {});
      await registry.complete(run.id, { result: "success" });

      const updated = registry.get(run.id);
      expect(updated?.status).toBe("completed");
      expect(updated?.endedAt).toBeInstanceOf(Date);
      expect(updated?.checkpoint.result).toEqual({ result: "success" });
    });
  });

  describe("fail", () => {
    it("失敗状態に更新してエラーを記録する", async () => {
      const run = await registry.start("test-agent", {});
      await registry.fail(run.id, "Something went wrong");

      const updated = registry.get(run.id);
      expect(updated?.status).toBe("failed");
      expect(updated?.endedAt).toBeInstanceOf(Date);
      expect(updated?.error).toBe("Something went wrong");
    });
  });

  describe("setSessionId", () => {
    it("SDKセッションIDを設定する", async () => {
      const run = await registry.start("test-agent", {});
      await registry.setSessionId(run.id, "sdk-session-123");

      const updated = registry.get(run.id);
      expect(updated?.sessionId).toBe("sdk-session-123");
    });
  });

  describe("getPending", () => {
    it("未完了の実行を返す", async () => {
      const mockRuns = [
        {
          id: "run1",
          status: "running" as const,
          agentName: "a",
          inputDigest: "",
          toolCalls: [],
          checkpoint: {},
          createdAt: new Date(),
        },
        {
          id: "run2",
          status: "completed" as const,
          agentName: "b",
          inputDigest: "",
          toolCalls: [],
          checkpoint: {},
          createdAt: new Date(),
        },
        {
          id: "run3",
          status: "pending" as const,
          agentName: "c",
          inputDigest: "",
          toolCalls: [],
          checkpoint: {},
          createdAt: new Date(),
        },
      ];
      vi.mocked(mockStore.listAll).mockResolvedValue(mockRuns);

      const pending = await registry.getPending();

      expect(pending).toHaveLength(2);
      expect(pending.map((r) => r.id)).toEqual(["run1", "run3"]);
    });
  });
});
