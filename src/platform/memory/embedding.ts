import OpenAI from "openai";
import type { EmbeddingProvider } from "./types.js";
import { getConfiguredDimensions } from "./types.js";

const BATCH_SIZE = 100;
const DEFAULT_MODEL = "text-embedding-3-small";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  readonly dimensions: number;
  readonly model: string;

  constructor(options?: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
    dimensions?: number;
  }) {
    this.client = new OpenAI({
      apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: options?.baseURL ?? process.env.OPENAI_BASE_URL,
    });
    this.model = options?.model ?? process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL;
    this.dimensions = options?.dimensions ?? getConfiguredDimensions();
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });
      results.push(...response.data.map((d) => d.embedding));
    }
    return results;
  }
}

export class DummyEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly model = "dummy";

  constructor() {
    this.dimensions = getConfiguredDimensions();
  }

  async embed(text: string): Promise<number[]> {
    return this.generateDummyVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateDummyVector(text));
  }

  private generateDummyVector(text: string): number[] {
    const vector: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      const charCode = text.charCodeAt(i % text.length) || 0;
      vector.push(Math.sin(charCode * (i + 1)) * 0.1);
    }
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => v / (norm || 1));
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  if (apiKey || baseURL) {
    const provider = new OpenAIEmbeddingProvider();
    const source = baseURL ? `${baseURL}` : "OpenAI API";
    console.log(
      `Memory: Using ${provider.model} (${provider.dimensions}d) from ${source}`,
    );
    return provider;
  }

  console.warn(
    "⚠️ OPENAI_API_KEY未設定: 意味的検索が無効です (DummyEmbeddingProvider使用)",
  );
  return new DummyEmbeddingProvider();
}
