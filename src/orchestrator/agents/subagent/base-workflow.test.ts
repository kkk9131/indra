import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseWorkflow } from "./base-workflow.js";
import { RunRegistry } from "./run-registry.js";
import { CheckpointStore } from "./checkpoint.js";

// テスト用の型定義
interface TestInput {
  taskId: string;
  data: string;
}

interface TestOutput {
  success: boolean;
  runId: string;
  result?: string;
}

interface TestCheckpoint {
  phase: string;
  progress: number;
}

// テスト用の具象ワークフロー
class TestWorkflow extends BaseWorkflow<TestInput, TestOutput, TestCheckpoint> {
  public runFn: (runId: string, input: TestInput) => Promise<TestOutput> =
    async (runId) => ({
      success: true,
      runId,
      result: "done",
    });

  protected get agentName(): string {
    return "test-agent";
  }

  protected initCheckpoint(_input: TestInput): TestCheckpoint {
    return { phase: "init", progress: 0 };
  }

  protected async run(runId: string, input: TestInput): Promise<TestOutput> {
    return this.runFn(runId, input);
  }
}

// インメモリのCheckpointStoreモック
function createMockStore(): CheckpointStore {
  const store = new CheckpointStore("/tmp/test-runs-" + Date.now());
  // save/load/listAll/deleteをモック化してディスクI/Oを避ける
  const data = new Map<string, string>();
  vi.spyOn(store, "save").mockImplementation(async (run) => {
    data.set(run.id, JSON.stringify(run));
  });
  vi.spyOn(store, "load").mockImplementation(async (runId) => {
    const raw = data.get(runId);
    return raw ? JSON.parse(raw) : null;
  });
  vi.spyOn(store, "listAll").mockImplementation(async () => {
    return Array.from(data.values()).map((v) => JSON.parse(v));
  });
  vi.spyOn(store, "delete").mockImplementation(async (runId) => {
    data.delete(runId);
  });
  return store;
}

describe("BaseWorkflow", () => {
  let registry: RunRegistry;
  let workflow: TestWorkflow;

  beforeEach(() => {
    const store = createMockStore();
    registry = new RunRegistry(store);
    workflow = new TestWorkflow(registry);
  });

  describe("ライフサイクル: execute()", () => {
    it("正常系: start → run → complete", async () => {
      const input: TestInput = { taskId: "t1", data: "hello" };

      const result = await workflow.execute(input);

      expect(result.success).toBe(true);
      expect(result.runId).toMatch(/^run_/);
      expect(result.result).toBe("done");

      // レジストリでcompleted状態になっている
      const run = registry.get(result.runId);
      expect(run?.status).toBe("completed");
      expect(run?.endedAt).toBeInstanceOf(Date);
    });

    it("チェックポイントが初期化される", async () => {
      const input: TestInput = { taskId: "t2", data: "world" };

      const result = await workflow.execute(input);

      const run = registry.get(result.runId);
      expect(run?.checkpoint).toMatchObject({
        phase: "init",
        progress: 0,
      });
    });

    it("エラー時: start → run(throw) → fail", async () => {
      workflow.runFn = async () => {
        throw new Error("test error");
      };

      const input: TestInput = { taskId: "t3", data: "fail" };

      await expect(workflow.execute(input)).rejects.toThrow("test error");

      // レジストリでfailed状態になっている
      const allRuns = await registry.getPending();
      // pendingにはないはず（failedだから）
      expect(allRuns).toHaveLength(0);
    });
  });

  describe("ライフサイクルフック", () => {
    it("onStart / onComplete が呼ばれる", async () => {
      const onStart = vi.fn();
      const onComplete = vi.fn();
      workflow.setLifecycleHooks({ onStart, onComplete });

      await workflow.execute({ taskId: "t4", data: "hooks" });

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart).toHaveBeenCalledWith(
        expect.stringMatching(/^run_/),
        "test-agent",
      );
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("onFail がエラー時に呼ばれる", async () => {
      const onFail = vi.fn();
      workflow.setLifecycleHooks({ onFail });
      workflow.runFn = async () => {
        throw new Error("hook error");
      };

      await expect(
        workflow.execute({ taskId: "t5", data: "fail" }),
      ).rejects.toThrow("hook error");

      expect(onFail).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledWith(
        expect.stringMatching(/^run_/),
        "test-agent",
        "hook error",
      );
    });
  });

  describe("リトライ: executeWithRetry()", () => {
    it("一時的失敗 → リトライ → 成功", async () => {
      let attempt = 0;
      workflow.runFn = async (runId) => {
        attempt++;
        if (attempt < 3) {
          throw new Error("transient error");
        }
        return { success: true, runId, result: "recovered" };
      };

      const result = await workflow.executeWithRetry(
        { taskId: "t6", data: "retry" },
        { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1 },
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("recovered");
      expect(attempt).toBe(3);
    });

    it("全リトライ失敗時は例外を投げる", async () => {
      workflow.runFn = async () => {
        throw new Error("permanent error");
      };

      await expect(
        workflow.executeWithRetry(
          { taskId: "t7", data: "fail-all" },
          { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1 },
        ),
      ).rejects.toThrow("permanent error");
    });

    it("retryableErrorsでフィルタリング", async () => {
      let attempt = 0;
      workflow.runFn = async () => {
        attempt++;
        throw new Error("non-retryable error");
      };

      await expect(
        workflow.executeWithRetry(
          { taskId: "t8", data: "filtered" },
          {
            maxRetries: 3,
            initialDelayMs: 10,
            retryableErrors: ["transient"],
          },
        ),
      ).rejects.toThrow("non-retryable error");

      // retryableErrorsに該当しないので1回で打ち切り
      expect(attempt).toBe(1);
    });

    it("onRetryフックが呼ばれる", async () => {
      const onRetry = vi.fn();
      workflow.setLifecycleHooks({ onRetry });

      let attempt = 0;
      workflow.runFn = async (runId) => {
        attempt++;
        if (attempt < 2) throw new Error("retry me");
        return { success: true, runId, result: "ok" };
      };

      await workflow.executeWithRetry(
        { taskId: "t9", data: "hook-retry" },
        { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1 },
      );

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith("", "test-agent", 1, "retry me");
    });
  });

  describe("復旧: recoverPendingRuns()", () => {
    it("completedフェーズのpending runを完了させる", async () => {
      // 手動でrunning状態のrunを作成（checkpoint.phase = "completed"）
      const run = await registry.start("test-agent", { taskId: "r1" });
      await registry.updateCheckpoint(run.id, {
        phase: "completed",
        progress: 100,
      });

      // この時点ではstatusはrunning
      expect(registry.get(run.id)?.status).toBe("running");

      await workflow.recoverPendingRuns();

      // recoveryでcompletedに変わる
      expect(registry.get(run.id)?.status).toBe("completed");
    });

    it("他のエージェントのrunは無視する", async () => {
      const run = await registry.start("other-agent", { taskId: "r2" });
      await registry.updateCheckpoint(run.id, {
        phase: "completed",
        progress: 100,
      });

      await workflow.recoverPendingRuns();

      // other-agentなので変更されない
      expect(registry.get(run.id)?.status).toBe("running");
    });

    it("中断状態のrunはそのまま（ログのみ）", async () => {
      const run = await registry.start("test-agent", { taskId: "r3" });
      await registry.updateCheckpoint(run.id, {
        phase: "generating",
        progress: 50,
      });

      await workflow.recoverPendingRuns();

      // statusは変わらない
      expect(registry.get(run.id)?.status).toBe("running");
    });
  });

  describe("updatePhase()", () => {
    it("チェックポイントのphaseが更新される", async () => {
      let capturedRunId = "";
      workflow.runFn = async (runId, _input) => {
        capturedRunId = runId;
        // protectedメソッドをrun内から呼ぶ
        await (workflow as any).updatePhase(runId, "processing");
        return { success: true, runId, result: "phased" };
      };

      await workflow.execute({ taskId: "p1", data: "phase-test" });

      const run = registry.get(capturedRunId);
      // 最後にupdatePhaseで"processing"が設定された（その後completeでresultが追加される）
      expect(run?.checkpoint).toMatchObject({ phase: "processing" });
    });
  });

  describe("ensureLLMProvider()", () => {
    it("LLMプロバイダー未設定時にエラー", async () => {
      workflow.runFn = async (runId) => {
        (workflow as any).ensureLLMProvider();
        return { success: true, runId };
      };

      await expect(
        workflow.execute({ taskId: "llm1", data: "no-provider" }),
      ).rejects.toThrow("LLM provider with agent support not configured");
    });
  });
});
