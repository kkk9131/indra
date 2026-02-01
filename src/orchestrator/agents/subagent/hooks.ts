/**
 * SDK Hooks統合
 *
 * Claude Agent SDKのフックを使用して、ツール実行と完了を自動記録
 */

import type { RunRegistry } from "./run-registry.js";

/**
 * PostToolUseフックの入力型
 */
export interface PostToolUseInput {
  tool_use_id: string;
  tool_input: {
    tool?: string;
    [key: string]: unknown;
  };
}

/**
 * PostToolUseフックのコンテキスト型
 */
export interface PostToolUseContext {
  result: unknown;
}

/**
 * フックの戻り値型
 */
export interface HookResult {
  [key: string]: unknown;
}

/**
 * PostToolUseフック定義
 */
export interface PostToolUseMatcher {
  matcher: string;
  hooks: Array<
    (
      input: PostToolUseInput,
      toolUseId: string,
      context: PostToolUseContext,
    ) => Promise<HookResult>
  >;
}

/**
 * Stopフック定義
 */
export interface StopMatcher {
  hooks: Array<() => Promise<HookResult>>;
}

/**
 * フック設定全体
 */
export interface RegistryHooks {
  PostToolUse: PostToolUseMatcher[];
  Stop: StopMatcher[];
}

/**
 * RunRegistry用のSDKフックを作成
 *
 * @param registry RunRegistryインスタンス
 * @param runId 実行ID
 * @returns SDK hooks設定
 */
export function createRegistryHooks(
  registry: RunRegistry,
  runId: string,
): RegistryHooks {
  return {
    PostToolUse: [
      {
        matcher: ".*", // 全ツールにマッチ
        hooks: [
          async (
            input: PostToolUseInput,
            _toolUseId: string,
            context: PostToolUseContext,
          ): Promise<HookResult> => {
            const toolName = input.tool_input?.tool ?? "unknown";
            await registry.recordToolCall(
              runId,
              toolName,
              input.tool_input,
              context.result,
            );
            return {};
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          async (): Promise<HookResult> => {
            await registry.complete(runId);
            return {};
          },
        ],
      },
    ],
  };
}

/**
 * エラーハンドリング付きのフック作成
 */
export function createRegistryHooksWithErrorHandling(
  registry: RunRegistry,
  runId: string,
  onError?: (error: Error) => void,
): RegistryHooks {
  const baseHooks = createRegistryHooks(registry, runId);

  return {
    PostToolUse: [
      {
        matcher: ".*",
        hooks: [
          async (
            input: PostToolUseInput,
            toolUseId: string,
            context: PostToolUseContext,
          ): Promise<HookResult> => {
            try {
              return await baseHooks.PostToolUse[0].hooks[0](
                input,
                toolUseId,
                context,
              );
            } catch (error) {
              onError?.(error as Error);
              return {};
            }
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          async (): Promise<HookResult> => {
            try {
              return await baseHooks.Stop[0].hooks[0]();
            } catch (error) {
              onError?.(error as Error);
              // Stopフックでエラーが発生しても、failedとして記録
              try {
                await registry.fail(runId, (error as Error).message);
              } catch {
                // 二重エラーは無視
              }
              return {};
            }
          },
        ],
      },
    ],
  };
}
