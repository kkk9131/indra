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

    if (signal?.aborted) {
      const reason =
        signal.reason instanceof Error
          ? signal.reason.message
          : String(signal.reason ?? "Cancelled");
      await hooks?.onCancel?.(reason);
      yield { type: "cancelled", reason };
      return;
    }

    const textMessages = this.normalizeToTextMessages(messages);
    const queryOptions = this.buildAgentQueryOptions(
      textMessages,
      options,
      agentOpts,
    );

    if (hasImageContent(messages)) {
      console.warn(
        "[AgentSDK] Images in messages are not yet fully supported by the SDK. Text content was extracted.",
      );
    }

    let turnNumber = 0;

    try {
      for await (const message of query(queryOptions)) {
        if (signal?.aborted) {
          const reason =
            signal.reason instanceof Error
              ? signal.reason.message
              : String(signal.reason ?? "Cancelled");
          await hooks?.onCancel?.(reason);
          yield { type: "cancelled", reason };
          return;
        }

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
    type SDKSettingSource = "user" | "project";

    const systemPrompt = options?.systemPrompt ?? this.config.systemPrompt;

    const queryOpts: {
      model: ClaudeModel;
      maxTurns: number;
      allowedTools?: string[];
      permissionMode?: SDKPermissionMode;
      systemPrompt?: string;
      cwd?: string;
      settingSources?: SDKSettingSource[];
    } = {
      model: this.resolveModel(options),
      maxTurns: agentOpts.maxTurns ?? 10,
      cwd: process.cwd(),
      settingSources: ["user", "project"],
    };

    if (systemPrompt) {
      queryOpts.systemPrompt = systemPrompt;
    }

    if (agentOpts.tools && agentOpts.tools.length > 0) {
      queryOpts.allowedTools = agentOpts.tools;
    }

    if (agentOpts.permissionMode) {
      queryOpts.permissionMode = agentOpts.permissionMode as SDKPermissionMode;
    }

    return {
      prompt: this.buildUserPrompt(messages),
      options: queryOpts,
    };
  }

  private buildQueryOptions(
    messages: Message[],
    options?: ChatOptions,
  ): {
    prompt: string;
    options: { model: ClaudeModel; maxTurns: number; systemPrompt?: string };
  } {
    const systemPrompt = options?.systemPrompt ?? this.config.systemPrompt;

    return {
      prompt: this.buildUserPrompt(messages),
      options: {
        model: this.resolveModel(options),
        maxTurns: 1,
        ...(systemPrompt && { systemPrompt }),
      },
    };
  }

  private resolveModel(options?: ChatOptions): ClaudeModel {
    return (options?.model ?? this.config.model ?? "sonnet") as ClaudeModel;
  }

  private buildUserPrompt(messages: Message[]): string {
    const parts: string[] = [];

    for (const msg of messages) {
      if (msg.role === "system") continue;
      const prefix = msg.role === "user" ? "User" : "Assistant";
      parts.push(`${prefix}: ${msg.content}`);
    }

    return parts.join("\n\n");
  }
}
