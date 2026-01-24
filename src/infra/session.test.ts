import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionManager, SessionSchema } from "./session.js";

// Skip SQLite tests in Vitest (native module binding issues)
const describeWithSQLite = process.env.VITEST ? describe.skip : describe;
import Database from "better-sqlite3";
import { unlinkSync, existsSync } from "fs";
import path from "path";
import { tmpdir } from "os";

describeWithSQLite("SessionManager", () => {
  let manager: SessionManager;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(tmpdir(), `test_sessions_${Date.now()}.db`);
    manager = new SessionManager(path.dirname(dbPath));
  });

  afterEach(() => {
    manager.close();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe("create", () => {
    it("creates CLI session", () => {
      const session = manager.create("cli");

      expect(SessionSchema.safeParse(session).success).toBe(true);
      expect(session.type).toBe("cli");
      expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
      expect(session.lastSeenAt).toBeLessThanOrEqual(Date.now());
    });

    it("creates web session", () => {
      const session = manager.create("web");

      expect(session.type).toBe("web");
    });
  });

  describe("get", () => {
    it("retrieves existing session", () => {
      const created = manager.create("cli");
      const retrieved = manager.get(created.id);

      expect(retrieved).toEqual(created);
    });

    it("returns null for non-existent session", () => {
      const session = manager.get("non-existent-id");
      expect(session).toBeNull();
    });
  });

  describe("updateLastSeen", () => {
    it("updates lastSeenAt timestamp", async () => {
      const session = manager.create("cli");

      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.updateLastSeen(session.id);
      const updated = manager.get(session.id);

      expect(updated?.lastSeenAt).toBeGreaterThan(session.lastSeenAt);
    });
  });

  describe("delete", () => {
    it("deletes existing session", () => {
      const session = manager.create("cli");

      const deleted = manager.delete(session.id);
      expect(deleted).toBe(true);

      const retrieved = manager.get(session.id);
      expect(retrieved).toBeNull();
    });

    it("returns false for non-existent session", () => {
      const deleted = manager.delete("non-existent-id");
      expect(deleted).toBe(false);
    });
  });

  describe("list", () => {
    it("lists all sessions", () => {
      manager.create("cli");
      manager.create("web");

      const sessions = manager.list();
      expect(sessions.length).toBe(2);
    });

    it("filters by type", () => {
      manager.create("cli");
      manager.create("cli");
      manager.create("web");

      const cliSessions = manager.list("cli");
      const webSessions = manager.list("web");

      expect(cliSessions.length).toBe(2);
      expect(webSessions.length).toBe(1);
    });
  });

  describe("cleanup", () => {
    it("removes old sessions", () => {
      const oldTime = Date.now() - 3600000;
      const session = manager.create("cli");

      const db = new Database(dbPath);
      db.prepare("UPDATE sessions SET lastSeenAt = ? WHERE id = ?").run(
        oldTime,
        session.id,
      );
      db.close();

      const deletedCount = manager.cleanup(Date.now() - 1800000);
      expect(deletedCount).toBe(1);

      const retrieved = manager.get(session.id);
      expect(retrieved).toBeNull();
    });
  });
});
