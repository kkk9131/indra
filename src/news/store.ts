import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { NewsArticle } from "./types.js";
import { NewsArticleSchema } from "./types.js";

export class NewsStore {
  private readonly dir: string;

  constructor(baseDir?: string) {
    this.dir = baseDir ?? join(homedir(), ".indra", "news");
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  private getFilePath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private readArticle(path: string): NewsArticle | null {
    try {
      const data = readFileSync(path, "utf-8");
      return NewsArticleSchema.parse(JSON.parse(data));
    } catch {
      return null;
    }
  }

  private writeArticle(article: NewsArticle): void {
    const path = this.getFilePath(article.id);
    writeFileSync(path, JSON.stringify(article, null, 2));
  }

  save(articles: NewsArticle[]): void {
    for (const article of articles) {
      this.writeArticle(article);
    }
  }

  list(): NewsArticle[] {
    if (!existsSync(this.dir)) {
      return [];
    }

    const jsonFiles = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const articles: NewsArticle[] = [];

    for (const file of jsonFiles) {
      const article = this.readArticle(join(this.dir, file));
      if (article) {
        articles.push(article);
      }
    }

    return articles.sort(
      (a, b) =>
        new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime(),
    );
  }

  getById(id: string): NewsArticle | null {
    const path = this.getFilePath(id);
    if (!existsSync(path)) return null;
    return this.readArticle(path);
  }

  hasHash(hash: string): boolean {
    const articles = this.list();
    return articles.some((article) => article.contentHash === hash);
  }
}
