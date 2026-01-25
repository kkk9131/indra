import OpenAI from "openai";
import type {
  LLMProvider,
  LLMProviderConfig,
  Message,
  ChatOptions,
} from "./types.js";

const DEFAULT_MODEL = "gpt-4o";

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI";

  private client: OpenAI;
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig = {}) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const response = await this.client.chat.completions.create(
      this.buildRequestParams(messages, options),
    );

    return response.choices[0]?.message?.content ?? "";
  }

  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      ...this.buildRequestParams(messages, options),
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  private buildRequestParams(
    messages: Message[],
    options?: ChatOptions,
  ): OpenAI.ChatCompletionCreateParamsNonStreaming {
    return {
      model: options?.model ?? this.config.defaultModel ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? this.config.defaultMaxTokens ?? 2048,
      temperature:
        options?.temperature ?? this.config.defaultTemperature ?? 0.7,
      messages: this.convertMessages(messages, options?.systemPrompt),
    };
  }

  private convertMessages(
    messages: Message[],
    systemPrompt?: string,
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      result.push({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      });
    }

    return result;
  }
}
