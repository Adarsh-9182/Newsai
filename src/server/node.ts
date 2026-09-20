/**
 * Bridges Node's (req, res) to the Web Request/Response that `handle` speaks.
 *
 * Vercel's Node runtime hands a function `IncomingMessage` and
 * `ServerResponse`, and the Node runtime is what this project needs: the
 * Postgres driver opens a TCP socket, which the edge runtime has no way to do.
 * So the API is written against web standards and meets Node here, in one
 * place, rather than being written twice.
 *
 * The local preview server uses this same adapter, so the path that runs in
 * production is the path that gets exercised while developing — the bridge
 * itself cannot quietly be wrong only in the deployed copy.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Store } from "./types.js";
import { handle } from "./app.js";

/** Absolute URL for the request, trusting the proxy headers a platform sets. */
function requestUrl(req: IncomingMessage): string {
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim() || "http";
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost");
  return new URL(req.url ?? "/", `${proto}://${host}`).toString();
}

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    // Node gives repeated headers as an array; set-cookie is the common one.
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else headers.set(key, value);
  }
  return headers;
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function toRequest(req: IncomingMessage): Promise<Request> {
  return new Request(requestUrl(req), {
    method: req.method ?? "GET",
    headers: toHeaders(req),
    body: await readBody(req),
  });
}

export async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") headers[key] = value;
  });
  // Several cookies must stay several headers, not one comma-joined string,
  // which is the one thing Headers.forEach cannot express.
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers["set-cookie"] = cookies;

  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** The whole API as a Node request handler. */
export async function nodeHandler(req: IncomingMessage, res: ServerResponse, store: Store | null): Promise<void> {
  await writeResponse(res, await handle(await toRequest(req), store));
}
