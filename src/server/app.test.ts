/**
 * Runs the whole API against BOTH stores. The Postgres run uses PGlite —
 * real Postgres compiled to WASM — so the SQL in postgres.ts is executed, not
 * assumed. If a query is wrong for Neon or Supabase, it fails here first.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { handle } from "./app.js";
import { Store } from "./types.js";
import { memoryStore } from "./store/memory.js";
import { postgresStore, migrate, Db } from "./store/postgres.js";

const ORIGIN = "http://localhost:3000";

async function pgStore(): Promise<Store> {
  const pg = new PGlite();
  const db: Db = { query: async <T>(t: string, p: readonly unknown[] = []) => (await pg.query(t, [...p])).rows as T[] };
  await migrate(db);
  await migrate(db); // idempotent: safe to run on every cold start
  return postgresStore(db);
}

/** A tiny cookie-keeping client, so tests read like a browser session. */
function client(store: Store) {
  let cookie = "";
  return async (method: string, path: string, data?: unknown, headers: Record<string, string> = {}) => {
    const res = await handle(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: {
          host: "localhost:3000", origin: ORIGIN, "content-type": "application/json",
          ...(cookie ? { cookie } : {}), ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      store,
    );
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0] ?? "";
    return { status: res.status, body: (await res.json()) as any, headers: res.headers, cookie: () => cookie };
  };
}

const CREDS = { email: "Ada@Example.com", password: "correct horse battery", name: "Ada" };

for (const [label, make] of [["memory", async () => memoryStore()], ["postgres (PGlite)", pgStore]] as const) {
  describe(label, () => {
    test("signup → me → logout → me", async () => {
      const c = client(await make());
      const s = await c("POST", "/api/auth/signup", CREDS);
      assert.equal(s.status, 200);
      assert.equal(s.body.user.email, "ada@example.com", "email is normalised");
      assert.equal(s.body.user.passwordHash, undefined, "hash never leaves the server");
      assert.match(s.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Lax/);

      assert.equal((await c("GET", "/api/me")).body.user.name, "Ada");
      await c("POST", "/api/auth/logout");
      assert.equal((await c("GET", "/api/me")).body.user, null, "session is really gone server-side");
    });

    test("duplicate email is refused; wrong password and unknown user look identical", async () => {
      const store = await make();
      const c = client(store);
      await c("POST", "/api/auth/signup", CREDS);
      assert.equal((await client(store)("POST", "/api/auth/signup", CREDS)).status, 409);

      const wrong = await client(store)("POST", "/api/auth/login", { ...CREDS, password: "nope nope nope" });
      const ghost = await client(store)("POST", "/api/auth/login", { email: "ghost@example.com", password: "whatever12" });
      assert.equal(wrong.status, 401);
      assert.deepEqual(wrong.body, ghost.body, "no account enumeration through the login error");
      assert.equal((await client(store)("POST", "/api/auth/login", CREDS)).status, 200);
    });

    test("validation", async () => {
      const c = client(await make());
      assert.equal((await c("POST", "/api/auth/signup", { email: "nope", password: "12345678" })).status, 400);
      assert.equal((await c("POST", "/api/auth/signup", { email: "a@b.co", password: "short" })).status, 400);
      assert.equal((await c("POST", "/api/auth/signup", "[]")).status, 400);
    });

    test("login is rate limited per account", async () => {
      const c = client(await make());
      await c("POST", "/api/auth/signup", CREDS);
      const codes: number[] = [];
      for (let i = 0; i < 10; i++) codes.push((await c("POST", "/api/auth/login", { ...CREDS, password: "wrong wrong" })).status);
      assert.equal(codes.at(-1), 429);
      assert.equal(codes[0], 401);
    });

    test("saves: add is idempotent, list, remove, scoped per user", async () => {
      const store = await make();
      const a = client(store);
      const b = client(store);
      await a("POST", "/api/auth/signup", CREDS);
      await b("POST", "/api/auth/signup", { email: "bob@example.com", password: "another long one" });

      const story = { storyId: "hn:1", title: "A story", url: "https://example.com/x", source: "Hacker News", slug: "a-story-1" };
      assert.equal((await a("POST", "/api/saves", story)).status, 200);
      assert.equal((await a("POST", "/api/saves", story)).status, 200);
      assert.equal((await a("GET", "/api/saves")).body.saves.length, 1);
      assert.equal((await b("GET", "/api/saves")).body.saves.length, 0, "another user sees none of it");

      assert.equal((await b("DELETE", "/api/saves?id=hn%3A1")).status, 200);
      assert.equal((await a("GET", "/api/saves")).body.saves.length, 1, "b cannot delete a's save");
      await a("DELETE", "/api/saves?id=hn%3A1");
      assert.equal((await a("GET", "/api/saves")).body.saves.length, 0);
    });

    test("saves reject javascript: links and bad slugs", async () => {
      const c = client(await make());
      await c("POST", "/api/auth/signup", CREDS);
      const base = { storyId: "x", title: "t", source: "s" };
      assert.equal((await c("POST", "/api/saves", { ...base, url: "javascript:alert(1)" })).status, 400);
      assert.equal((await c("POST", "/api/saves", { ...base, url: "https://a.co", slug: "../etc" })).status, 400);
    });

    test("prefs: follows are validated against the real tag list", async () => {
      const c = client(await make());
      await c("POST", "/api/auth/signup", CREDS);
      const ok = await c("PUT", "/api/prefs", { follows: ["agents", "india", "agents"], digest: true });
      assert.deepEqual(ok.body.user.follows, ["agents", "india"]);
      assert.equal(ok.body.user.digest, true);
      assert.equal((await c("PUT", "/api/prefs", { follows: ["<script>"], digest: false })).status, 400);
      assert.deepEqual((await c("GET", "/api/me")).body.user.follows, ["agents", "india"], "persisted");
    });

    test("subscribe works without an account and is idempotent", async () => {
      const c = client(await make());
      assert.equal((await c("POST", "/api/subscribe", { email: "reader@example.com" })).status, 200);
      assert.equal((await c("POST", "/api/subscribe", { email: "reader@example.com" })).status, 200);
      assert.equal((await c("POST", "/api/subscribe", { email: "bad" })).status, 400);
    });

    test("protected routes need a session", async () => {
      const c = client(await make());
      assert.equal((await c("GET", "/api/saves")).status, 401);
      assert.equal((await c("PUT", "/api/prefs", { follows: [], digest: false })).status, 401);
    });
  });
}

describe("request hardening", () => {
  test("cross-origin writes are refused, and non-JSON is refused", async () => {
    const c = client(memoryStore());
    assert.equal((await c("POST", "/api/auth/signup", CREDS, { origin: "https://evil.example" })).status, 403);
    assert.equal((await c("POST", "/api/auth/signup", CREDS, { origin: "", "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal((await c("POST", "/api/auth/signup", CREDS, { "content-type": "text/plain" })).status, 415);
  });

  test("no database configured → 503, health still answers", async () => {
    const res = await handle(new Request(`${ORIGIN}/api/me`, { headers: { host: "localhost:3000" } }), null);
    assert.equal(res.status, 503);
    const health = await handle(new Request(`${ORIGIN}/api/health`), null);
    assert.deepEqual(await health.json(), { ok: true, database: false });
  });

  test("Secure cookie over https; oversized body refused", async () => {
    const store = memoryStore();
    const res = await handle(
      new Request("https://newsai.example/api/auth/signup", {
        method: "POST",
        headers: { host: "newsai.example", origin: "https://newsai.example", "content-type": "application/json" },
        body: JSON.stringify(CREDS),
      }),
      store,
    );
    assert.match(res.headers.get("set-cookie") ?? "", /; Secure/);

    const big = await client(store)("POST", "/api/auth/login", { email: "a@b.co", password: "x".repeat(20_000) });
    assert.equal(big.status, 413);
  });
});
