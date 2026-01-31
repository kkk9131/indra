import type { TaskDefinition } from "./types.js";

/**
 * タスクレジストリ
 * 実行可能なタスク種類を管理
 */
export class TaskRegistry {
  private tasks = new Map<string, TaskDefinition>();

  /**
   * タスク定義を登録
   */
  register(definition: TaskDefinition): void {
    if (this.tasks.has(definition.type)) {
      console.warn(
        `TaskRegistry: Overwriting existing task type: ${definition.type}`,
      );
    }
    this.tasks.set(definition.type, definition);
    console.log(`TaskRegistry: Registered task type: ${definition.type}`);
  }

  /**
   * タスク定義を取得
   */
  get(type: string): TaskDefinition | undefined {
    return this.tasks.get(type);
  }

  /**
   * タスク定義が存在するか確認
   */
  has(type: string): boolean {
    return this.tasks.has(type);
  }

  /**
   * 登録済みタスク定義一覧を取得
   */
  list(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  /**
   * タスクタイプ一覧を取得
   */
  types(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * タスク定義を削除
   */
  unregister(type: string): boolean {
    return this.tasks.delete(type);
  }

  /**
   * すべてのタスク定義を削除
   */
  clear(): void {
    this.tasks.clear();
  }
}
