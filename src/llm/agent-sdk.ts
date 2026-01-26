import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  AgentChatOptions,
  AgentEvent,
  AgentOptions,
  ChatOptions,
  LLMProvider,
  LLMProviderConfig,
  Message,
} from "./types.js";

type ClaudeModel = "opus" | "sonnet" | "haiku";

function extractTextFromContent(content: unknown[]): string {
  return content
    .filter((block): block is { text: string } => "text" in (block as object))
    .map((block) => block.text)
    .join("");
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
    messages: Message[],
    options?: AgentChatOptions,
  ): AsyncIterable<AgentEvent> {
    const agentOpts = options?.agent ?? {};
    const queryOptions = this.buildAgentQueryOptions(
      messages,
      options,
      agentOpts,
    );

    let turnNumber = 0;

    for await (const message of query(queryOptions)) {
      // Handle assistant text messages
      if (message.type === "assistant" && message.message?.content) {
        const content = message.message.content as unknown[];
        for (const block of content) {
          if (this.isTextBlock(block)) {
            yield { type: "text", text: block.text };
          } else if (this.isToolUseBlock(block)) {
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
          if (this.isToolResultBlock(block)) {
            yield {
              type: "tool_result",
              tool: block.tool_use_id,
              result: this.extractToolResult(block.content),
              toolUseId: block.tool_use_id,
            };
          }
        }
        turnNumber++;
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
  }

  private isTextBlock(block: unknown): block is { type: "text"; text: string } {
    return (
      typeof block === "object" &&
      block !== null &&
      (block as { type?: string }).type === "text" &&
      typeof (block as { text?: string }).text === "string"
    );
  }

  private isToolUseBlock(
    block: unknown,
  ): block is { type: "tool_use"; id: string; name: string; input: unknown } {
    return (
      typeof block === "object" &&
      block !== null &&
      (block as { type?: string }).type === "tool_use"
    );
  }

  private isToolResultBlock(
    block: unknown,
  ): block is { type: "tool_result"; tool_use_id: string; content: unknown } {
    return (
      typeof block === "object" &&
      block !== null &&
      (block as { type?: string }).type === "tool_result"
    );
  }

  private extractToolResult(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter(
          (item): item is { type: "text"; text: string } =>
            typeof item === "object" &&
            item !== null &&
            (item as { type?: string }).type === "text",
        )
        .map((item) => item.text)
        .join("\n");
    }
    return JSON.stringify(content);
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
