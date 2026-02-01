import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { IdempotencyManager } from "./idempotency.js";

describe("IdempotencyManager", () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new IdempotencyManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.clear();
  });

  describe("generateKey", () => {
    it("articleIdとactionから一意のキーを生成する", () => {
      const key1 = manager.generateKey("article-1", "create-post");
      const key2 = manager.generateKey("article-1", "create-post");
      const key3 = manager.generateKey("article-2", "create-post");

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toHaveLength(32);
    });
  });

  describe("checkAndSet", () => {
    it("初回呼び出しでalreadyExecuted: falseを返す", () => {
      const key = manager.generateKey("article-1", "action-1");
      const result = manager.checkAndSet(key);

      expect(result.alreadyExecuted).toBe(false);
      expect(result.result).toBeUndefined();
    });

    it("2回目の呼び出しでalreadyExecuted: trueを返す", () => {
      const key = manager.generateKey("article-1", "action-1");
      manager.checkAndSet(key);
      const result = manager.checkAndSet(key);

      expect(result.alreadyExecuted).toBe(true);
    });

    it("期限切れ後はalreadyExecuted: falseを返す", () => {
      const shortTTL = 1000; // 1秒
      const shortManager = new IdempotencyManager(shortTTL);
      const key = shortManager.generateKey("article-1", "action-1");

      shortManager.checkAndSet(key);

      // 2秒進める
      vi.advanceTimersByTime(2000);

      const result = shortManager.checkAndSet(key);
      expect(result.alreadyExecuted).toBe(false);
    });
  });

  describe("recordSuccess", () => {
    it("結果を記録する", () => {
      const key = manager.generateKey("article-1", "action-1");
      manager.checkAndSet(key);
      manager.recordSuccess(key, { postId: "123" });

      const result = manager.checkAndSet(key);
      expect(result.alreadyExecuted).toBe(true);
      expect(result.result).toEqual({ postId: "123" });
    });
  });

  describe("clearOnFailure", () => {
    it("キーを削除して再試行を許可する", () => {
      const key = manager.generateKey("article-1", "action-1");
      manager.checkAndSet(key);
      manager.clearOnFailure(key);

      const result = manager.checkAndSet(key);
      expect(result.alreadyExecuted).toBe(false);
    });
  });

  describe("get", () => {
    it("レコードを取得する", () => {
      const key = manager.generateKey("article-1", "action-1");
      manager.checkAndSet(key);
      manager.recordSuccess(key, { data: "test" });

      const record = manager.get(key);
      expect(record).toBeDefined();
      expect(record?.result).toEqual({ data: "test" });
    });

    it("存在しないキーでundefinedを返す", () => {
      const record = manager.get("non-existent");
      expect(record).toBeUndefined();
    });
  });
});
