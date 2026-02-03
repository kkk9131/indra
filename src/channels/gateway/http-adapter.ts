import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { Hono } from "hono";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

function toRequest(req: IncomingMessage): Request {
  const method = req.method ?? "GET";
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  if (BODYLESS_METHODS.has(method)) {
    return new Request(url, { method, headers });
  }

  const body = Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>;
  return new Request(url, { method, headers, body, duplex: "half" });
}

export async function handleHonoRequest(
  app: Hono,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const request = toRequest(req);
  const response = await app.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (req.method === "HEAD" || !response.body) {
    res.end();
    return;
  }

  const body = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
  body.pipe(res);
}
