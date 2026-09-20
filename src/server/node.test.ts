/**
 * The Node bridge, tested through a real HTTP server rather than fakes.
 *
 * This is the piece that only runs in production if it is not exercised here:
 * the app's own tests call `handle` with a Request they construct, which would
 * never catch a header, a body or a cookie lost on the way in or out.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import { nodeHandler } from "./node.js";
import { memoryStore } from "./store/memory.js";

const store = memoryStore();
const server: Server = createServer((req, res) => {
  nodeHandler(req, res, store).catch(() => {
    res.writeHead(500).end();
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => server.close());

describe("node adapter", () => {
  test("a POST with a JSON body round-trips, and the session cookie comes back", async () => {
    const res = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ email: "ada@example.com", password: "correct horse battery", name: "Ada" }),
    });
    assert.equal(res.status, 200, await res.text());
    const cookies = res.headers.getSetCookie();
    assert.equal(cookies.length, 1, "exactly one Set-Cookie header");
    assert.match(cookies[0] ?? "", /^nai_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax/);

    // And it authenticates the next request, which is the whole point.
    const me = await fetch(`${base}/api/me`, { headers: { cookie: (cookies[0] ?? "").split(";")[0] ?? "" } });
    assert.equal(((await me.json()) as any).user.email, "ada@example.com");
  });

  test("logout sends its own cookie back through Node unchanged", async () => {
    const res = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: "{}",
    });
    assert.match(res.headers.getSetCookie()[0] ?? "", /nai_session=; .*Max-Age=0/);
  });

  test("x-forwarded-proto: https makes the cookie Secure", async () => {
    const res = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "newsai.co.in",
        origin: "https://newsai.co.in",
      },
      body: JSON.stringify({ email: "grace@example.com", password: "another long password" }),
    });
    assert.equal(res.status, 200, await res.text());
    assert.match(res.headers.getSetCookie()[0] ?? "", /; Secure/, "behind a TLS proxy the cookie must be Secure");
  });

  test("the query string survives, and a GET carries no body", async () => {
    const res = await fetch(`${base}/api/saves?id=hn%3A1`, { method: "DELETE", headers: { origin: base } });
    assert.equal(res.status, 401, "no session — but the route was reached and parsed");
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  });

  test("a non-API path is a 404 from the app, not a crash", async () => {
    assert.equal((await fetch(`${base}/not-api`)).status, 404);
  });
});
