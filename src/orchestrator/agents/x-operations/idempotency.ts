/**
 * 冪等性管理
 *
 * 投稿の二重実行を防止
 */

import { createHash } from "node:crypto";

export interface IdempotencyRecord {
  key: string;
  result: unknown;
  timestamp: Date;
  expiresAt: Date;
}

export class IdempotencyManager {
  private records = new Map<string, IdempotencyRecord>();

  /** デフォルトの有効期限（24時間） */
  private defaultTTL = 24 * 60 * 60 * 1000;

  constructor(ttlMs?: number) {
    if (ttlMs !== undefined) {
      this.defaultTTL = ttlMs;
    }
  }

  /**
   * 冪等キーを生成
   */
  generateKey(articleId: string, action: string): string {
    const input = `${articleId}:${action}`;
    return createHash("sha256").update(input).digest("hex").slice(0, 32);
  }

  /**
   * 投稿前にチェック
   * @returns alreadyExecuted: true の場合、既に実行済み
   */
  checkAndSet(key: string): { alreadyExecuted: boolean; result?: unknown } {
    this.cleanupExpired();

    const existing = this.records.get(key);
    if (existing && existing.expiresAt > new Date()) {
      return { alreadyExecuted: true, result: existing.result };
    }

    // 予約（結果はまだない）
    this.records.set(key, {
      key,
      result: null,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.defaultTTL),
    });

    return { alreadyExecuted: false };
  }

  /**
   * 投稿成功後に結果を記録
   */
  recordSuccess(key: string, result: unknown): void {
    const existing = this.records.get(key);
    if (existing) {
      existing.result = result;
      existing.timestamp = new Date();
    } else {
      this.records.set(key, {
        key,
        result,
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + this.defaultTTL),
      });
    }
  }

  /**
   * 失敗時にキーを削除（再試行を許可）
   */
  clearOnFailure(key: string): void {
    this.records.delete(key);
  }

  /**
   * 期限切れレコードをクリーンアップ
   */
  private cleanupExpired(): void {
    const now = new Date();
    for (const [key, record] of this.records.entries()) {
      if (record.expiresAt <= now) {
        this.records.delete(key);
      }
    }
  }

  /**
   * キーの状態を確認
   */
  get(key: string): IdempotencyRecord | undefined {
    this.cleanupExpired();
    return this.records.get(key);
  }

  /**
   * 全レコードをクリア（テスト用）
   */
  clear(): void {
    this.records.clear();
  }
}

export const idempotencyManager = new IdempotencyManager();
