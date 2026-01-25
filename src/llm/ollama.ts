import type {
  LLMProvider,
  LLMProviderConfig,
  Message,
  ChatOptions,
} from "./types.js";

const DEFAULT_MODEL = "llama3.2";
const DEFAULT_BASE_URL = "http://localhost:11434";

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaResponse {
  message: {
    content: string;
  };
}

interface OllamaStreamResponse {
  message: {
    content: string;
  };
  done: boolean;
}

export class OllamaProvider implements LLMProvider {
  readonly id = "ollama" as const;
  readonly name = "Ollama";

  private config: LLMProviderConfig;
  private baseUrl: string;

  constructor(config: LLMProviderConfig = {}) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const response = await this.sendRequest(messages, options, false);
    const data = (await response.json()) as OllamaResponse;
    return data.message.content;
  }

  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const response = await this.sendRequest(messages, options, true);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as OllamaStreamResponse;
          if (data.message?.content) {
            yield data.message.content;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  private async sendRequest(
    messages: Message[],
    options: ChatOptions | undefined,
    stream: boolean,
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options?.model ?? this.config.defaultModel ?? DEFAULT_MODEL,
        messages: this.convertMessages(messages, options?.systemPrompt),
        stream,
        options: {
          temperature:
            options?.temperature ?? this.config.defaultTemperature ?? 0.7,
          num_predict:
            options?.maxTokens ?? this.config.defaultMaxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    return response;
  }

  private convertMessages(
    messages: Message[],
    systemPrompt?: string,
  ): OllamaMessage[] {
    const result: OllamaMessage[] = [];

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
