import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ScheduleStore } from "./store.js";

describe("ScheduleStore", () => {
  let tempDir = "";
  let originalCwd = "";

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), "indra-schedule-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("migrates legacy scheduled_tasks from data/sessions.db", async () => {
    const legacyDir = join(tempDir, "data");
    await mkdir(legacyDir, { recursive: true });
    const legacyPath = join(legacyDir, "sessions.db");

    const legacyDb = new Database(legacyPath);
    legacyDb.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        task_type TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        config TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    legacyDb
      .prepare(
        `INSERT INTO scheduled_tasks (
          id, name, description, task_type, cron_expression,
          enabled, last_run_at, next_run_at, config, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "task-1",
        "Legacy Task",
        "from legacy",
        "news",
        "0 6 * * *",
        1,
        null,
        null,
        null,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    legacyDb.close();

    const newPath = join(tempDir, "new-sessions.db");
    const store = new ScheduleStore(newPath);
    const tasks = store.list();
    store.close();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("task-1");
    expect(tasks[0].name).toBe("Legacy Task");
  });
});
