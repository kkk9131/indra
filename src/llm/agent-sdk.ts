import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
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
