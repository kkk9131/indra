import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  AgentChatOptions,
  AgentEvent,
  AgentOptions,
  ChatOptions,
  ContentBlock,
  LLMProvider,
  LLMProviderConfig,
  Message,
  MultimodalMessage,
} from "./types.js";

type ClaudeModel = "opus" | "sonnet" | "haiku";

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: unknown;
}

function isTextBlock(block: unknown): block is TextBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: string }).type === "text" &&
    typeof (block as { text?: string }).text === "string"
  );
}

function isToolUseBlock(block: unknown): block is ToolUseBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: string }).type === "tool_use"
  );
}

function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: string }).type === "tool_result"
  );
}

function extractTextFromContent(content: unknown[]): string {
  return content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join("");
}

function hasImageContent(messages: (Message | MultimodalMessage)[]): boolean {
  return messages.some((msg) => {
    if (typeof msg.content === "string") return false;
    return msg.content.some(
      (block: ContentBlock) =>
        typeof block === "object" && block.type === "image",
    );
  });
}

export class AgentSDKProvider implements LLMProvider {
  readonly id = "agent-sdk" as const;
  readonly name = "Claude Agent SDK";
  private readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig = {}) {
    this.config = config;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const queryOptions = this.buildQueryOptions(messages, options);
    let result = "";

    for await (const message of query(queryOptions)) {
      if (message.type === "assistant" && message.message?.content) {
        result += extractTextFromContent(message.message.content);
      }
      if (
        message.type === "result" &&
        message.subtype === "success" &&
        message.result
      ) {
        result = message.result;
      }
    }

    return result;
  }

  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const queryOptions = this.buildQueryOptions(messages, options);

    for await (const message of query(queryOptions)) {
      if (message.type === "assistant" && message.message?.content) {
        yield extractTextFromContent(message.message.content);
      }
    }
  }

  async *chatStreamWithAgent(
    messages: Message[] | MultimodalMessage[],
    options?: AgentChatOptions,
  ): AsyncIterable<AgentEvent> {
    const agentOpts = options?.agent ?? {};
    const signal = options?.signal;
    const hooks = options?.hooks;

    // Check if cancelled before starting
    if (signal?.aborted) {
      const reason =
        signal.reason instanceof Error
          ? signal.reason.message
          : String(signal.reason ?? "Cancelled");
      await hooks?.onCancel?.(reason);
      yield { type: "cancelled", reason };
      return;
    }

    // Note: Full streaming input with images will be supported in future SDK versions.
    // For now, we extract text content from multimodal messages.
    const textMessages = this.normalizeToTextMessages(messages);
    const queryOptions = this.buildAgentQueryOptions(
      textMessages,
      options,
      agentOpts,
    );

    // Log if images were present but stripped
    if (hasImageContent(messages)) {
      console.warn(
        "[AgentSDK] Images in messages are not yet fully supported by the SDK. Text content was extracted.",
      );
    }

    let turnNumber = 0;

    try {
      for await (const message of query(queryOptions)) {
        // Check for cancellation
        if (signal?.aborted) {
          const reason =
            signal.reason instanceof Error
              ? signal.reason.message
              : String(signal.reason ?? "Cancelled");
          await hooks?.onCancel?.(reason);
          yield { type: "cancelled", reason };
          return;
        }

        // Handle assistant text messages
        if (message.type === "assistant" && message.message?.content) {
          const content = message.message.content as unknown[];
          for (const block of content) {
            if (isTextBlock(block)) {
              yield { type: "text", text: block.text };
            } else if (isToolUseBlock(block)) {
              await hooks?.onToolStart?.(block.name, block.input);
              yield {
                type: "tool_start",
                tool: block.name,
                input: block.input,
                toolUseId: block.id,
              };
            }
          }
        }

        // Handle tool results
        if (message.type === "user" && message.message?.content) {
          const content = message.message.content as unknown[];
          for (const block of content) {
            if (isToolResultBlock(block)) {
              const result = this.extractToolResult(block.content);
              await hooks?.onToolEnd?.(block.tool_use_id, result);
              yield {
                type: "tool_result",
                tool: block.tool_use_id,
                result,
                toolUseId: block.tool_use_id,
              };
            }
          }
          turnNumber++;
          await hooks?.onTurnComplete?.(turnNumber);
          yield { type: "turn_complete", turnNumber };
        }

        // Handle final result
        if (
          message.type === "result" &&
          message.subtype === "success" &&
          message.result
        ) {
          yield { type: "done", result: message.result };
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        await hooks?.onError?.(error);
      }
      throw error;
    }
  }

  private extractToolResult(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter(isTextBlock)
        .map((item) => item.text)
        .join("\n");
    }
    return JSON.stringify(content);
  }

  private normalizeToTextMessages(
    messages: Message[] | MultimodalMessage[],
  ): Message[] {
    return messages.map((msg) => {
      if (typeof msg.content === "string") {
        return msg as Message;
      }
      const textContent = msg.content
        .filter(isTextBlock)
        .map((block) => block.text)
        .join("\n");
      return { role: msg.role, content: textContent };
    });
  }

  private buildAgentQueryOptions(
    messages: Message[],
    options: AgentChatOptions | undefined,
    agentOpts: AgentOptions,
  ) {
    type SDKPermissionMode = "default" | "acceptEdits" | "bypassPermissions";

    const queryOpts: {
      model: ClaudeModel;
      maxTurns: number;
      allowedTools?: string[];
      permissionMode?: SDKPermissionMode;
    } = {
      model: this.resolveModel(options),
      maxTurns: agentOpts.maxTurns ?? 10,
    };

    if (agentOpts.tools && agentOpts.tools.length > 0) {
      queryOpts.allowedTools = agentOpts.tools;
    }

    if (agentOpts.permissionMode) {
      queryOpts.permissionMode = agentOpts.permissionMode as SDKPermissionMode;
    }

    return {
      prompt: this.buildPrompt(messages, options),
      options: queryOpts,
    };
  }

  private buildQueryOptions(
    messages: Message[],
    options?: ChatOptions,
  ): { prompt: string; options: { model: ClaudeModel; maxTurns: number } } {
    return {
      prompt: this.buildPrompt(messages, options),
      options: {
        model: this.resolveModel(options),
        maxTurns: 1,
      },
    };
  }

  private resolveModel(options?: ChatOptions): ClaudeModel {
    return (options?.model ?? this.config.model ?? "sonnet") as ClaudeModel;
  }

  private buildPrompt(messages: Message[], options?: ChatOptions): string {
    const systemPrompt = options?.systemPrompt ?? this.config.systemPrompt;
    const parts: string[] = [];

    if (systemPrompt) {
      parts.push(`System: ${systemPrompt}`);
    }

    for (const msg of messages) {
      if (msg.role === "system") continue;
      const prefix = msg.role === "user" ? "User" : "Assistant";
      parts.push(`${prefix}: ${msg.content}`);
    }

    return parts.join("\n\n");
  }
}
