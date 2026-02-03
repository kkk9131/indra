import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { Readable, Writable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHonoRequest } from "./http-adapter.js";

class MockIncomingMessage extends Readable {
  method?: string;
  url?: string;
  headers: Record<string, string> = {};

  constructor(body?: string) {
    super();
    if (body) {
      this.push(body);
    }
    this.push(null);
  }

  _read(): void {}
}

class MockServerResponse extends Writable {
  statusCode = 200;
  headers = new Map<string, string>();
  chunks: Buffer[] = [];

  setHeader(key: string, value: string): void {
    this.headers.set(key.toLowerCase(), value);
  }

  _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(chunk);
    callback();
  }

  get bodyText(): string {
    return Buffer.concat(this.chunks).toString("utf-8");
  }
}

describe("handleHonoRequest", () => {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));
  app.post("/echo", async (c) => c.json(await c.req.json()));

  it("serves GET routes", async () => {
    const req = new MockIncomingMessage() as IncomingMessage;
    req.method = "GET";
    req.url = "/health";
    req.headers = { host: "localhost" };

    const res = new MockServerResponse() as ServerResponse;

    await handleHonoRequest(app, req, res);
    await new Promise<void>((resolve) => res.on("finish", () => resolve()));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.bodyText)).toEqual({ ok: true });
  });

  it("passes request bodies", async () => {
    const req = new MockIncomingMessage(JSON.stringify({ value: "test" })) as
      | IncomingMessage
      | MockIncomingMessage;
    req.method = "POST";
    req.url = "/echo";
    req.headers = {
      host: "localhost",
      "content-type": "application/json",
    };

    const res = new MockServerResponse() as ServerResponse;

    await handleHonoRequest(app, req as IncomingMessage, res);
    await new Promise<void>((resolve) => res.on("finish", () => resolve()));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.bodyText)).toEqual({ value: "test" });
  });
});
