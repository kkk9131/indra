import {
  GoogleGenerativeAI,
  type Content,
  type ChatSession,
} from "@google/generative-ai";
import type {
  LLMProvider,
  LLMProviderConfig,
  Message,
  ChatOptions,
} from "./types.js";

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GoogleProvider implements LLMProvider {
  readonly id = "google" as const;
  readonly name = "Google Gemini";

  private client: GoogleGenerativeAI;
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig = {}) {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey ?? "");
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const { chat, lastContent } = this.prepareChat(messages, options);
    const result = await chat.sendMessage(lastContent);
    return result.response.text();
  }

  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const { chat, lastContent } = this.prepareChat(messages, options);
    const result = await chat.sendMessageStream(lastContent);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  private prepareChat(
    messages: Message[],
    options?: ChatOptions,
  ): { chat: ChatSession; lastContent: string } {
    const model = this.client.getGenerativeModel({
      model: options?.model ?? this.config.defaultModel ?? DEFAULT_MODEL,
      generationConfig: {
        maxOutputTokens:
          options?.maxTokens ?? this.config.defaultMaxTokens ?? 2048,
        temperature:
          options?.temperature ?? this.config.defaultTemperature ?? 0.7,
      },
      systemInstruction: options?.systemPrompt,
    });

    const history = this.convertMessages(messages.slice(0, -1));
    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({ history });

    return { chat, lastContent: lastMessage?.content ?? "" };
  }

  private convertMessages(messages: Message[]): Content[] {
    return messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));
  }
}
