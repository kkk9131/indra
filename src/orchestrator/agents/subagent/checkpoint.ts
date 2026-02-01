/**
 * チェックポイント永続化
 *
 * data/runs/{runId}.json に実行状態を保存
 */

import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { SubagentRun, SubagentRunSerialized } from "./types.js";
import { serializeRun, deserializeRun } from "./types.js";

export class CheckpointStore {
  constructor(private dataDir: string = "data/runs") {}

  private getFilePath(runId: string): string {
    return join(this.dataDir, `${runId}.json`);
  }

  async save(run: SubagentRun): Promise<void> {
    const filePath = this.getFilePath(run.id);
    await mkdir(dirname(filePath), { recursive: true });

    const serialized = serializeRun(run);
    await writeFile(filePath, JSON.stringify(serialized, null, 2), "utf-8");
  }

  async load(runId: string): Promise<SubagentRun | null> {
    const filePath = this.getFilePath(runId);

    try {
      const content = await readFile(filePath, "utf-8");
      const data: SubagentRunSerialized = JSON.parse(content);
      return deserializeRun(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async listAll(): Promise<SubagentRun[]> {
    try {
      const files = await readdir(this.dataDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const runs: SubagentRun[] = [];
      for (const file of jsonFiles) {
        const runId = file.replace(".json", "");
        const run = await this.load(runId);
        if (run) {
          runs.push(run);
        }
      }

      return runs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async delete(runId: string): Promise<void> {
    const filePath = this.getFilePath(runId);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export const defaultCheckpointStore = new CheckpointStore();
