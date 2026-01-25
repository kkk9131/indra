import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProvider,
  LLMProviderConfig,
  Message,
  ChatOptions,
} from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic" as const;
  readonly name = "Anthropic Claude";

  private client: Anthropic;
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig = {}) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const response = await this.client.messages.create({
      ...this.buildRequestParams(messages, options),
      stream: false,
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    return textBlock?.text ?? "";
  }

  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const stream = await this.client.messages.stream(
      this.buildRequestParams(messages, options),
    );

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  private buildRequestParams(
    messages: Message[],
    options?: ChatOptions,
  ): Anthropic.MessageCreateParams {
    return {
      model: options?.model ?? this.config.defaultModel ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? this.config.defaultMaxTokens ?? 2048,
      temperature: options?.temperature ?? this.config.defaultTemperature,
      system: options?.systemPrompt,
      messages: this.convertMessages(messages),
    };
  }

  private convertMessages(
    messages: Message[],
  ): Anthropic.MessageCreateParams["messages"] {
    return messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
  }
}
