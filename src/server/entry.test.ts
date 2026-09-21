/**
 * The deployed entrypoint, exercised as the platform calls it.
 *
 * api/index.js is the one file Vercel runs that the rest of the suite never
 * imports, and it is a five-line file whose only job is to point at the right
 * compiled module. That makes it exactly the kind of thing that breaks
 * silently: rename a directory or change rootDir, everything under src/ still
 * passes, and the first sign is a 500 in production.
 *
 * It is imported by a runtime URL rather than a static path so the compiler
 * does not try to pull a file outside rootDir into the build. From
 * dist/server/, the repo root is two levels up.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";

const entry = (await import(new URL("../../api/index.js", import.meta.url).href)) as {
  default: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => Promise<void>;
};

const server: Server = createServer((req, res) => {
  entry.default(req, res).catch((err) => res.writeHead(500).end(String(err)));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => server.close());

describe("api/index.js (the Vercel entrypoint)", () => {
  test("exports a (req, res) function, which is Vercel's Node contract", () => {
    assert.equal(typeof entry.default, "function");
    assert.equal(entry.default.length, 2);
  });

  test("serves a request through the compiled app", async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  });

  test("an unknown API route is a JSON error, not a crash", async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx, got ${res.status}`);
    assert.match(res.headers.get("content-type") ?? "", /json/);
  });
});
