/**
 * Tests for the mail path: the signed links, the confirm/unsubscribe routes,
 * and the sender's guarantee that nobody is mailed the same digest twice.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { handle } from "./app.js";
import { Store } from "./types.js";
import { memoryStore } from "./store/memory.js";
import { postgresStore, migrate, Db } from "./store/postgres.js";
import { makeToken, readToken, confirmUrl, unsubscribeUrl } from "./maillink.js";
import { CONFIRM_CLAIM } from "./types.js";
import { digestEmail, confirmEmail } from "./emails.js";
import { resendMailer, Mailer, Mail } from "./mailer.js";
import { Digest } from "../types.js";

const SECRET = "test-secret-at-least-16-chars";
const ORIGIN = "http://localhost:3000";

async function pgStore(): Promise<Store> {
  const pg = new PGlite();
  const db: Db = { query: async <T>(t: string, p: readonly unknown[] = []) => (await pg.query(t, [...p])).rows as T[] };
  await migrate(db);
  return postgresStore(db);
}

const get = (path: string, store: Store) => handle(new Request(`${ORIGIN}${path}`, { headers: { host: "localhost:3000" } }), store);
const post = (path: string, data: unknown, store: Store) =>
  handle(new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { host: "localhost:3000", origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(data),
  }), store);

describe("signed mail links", () => {
  test("round-trips, and is bound to its purpose", () => {
    const t = makeToken(SECRET, "confirm", "ada@example.com");
    assert.equal(readToken(SECRET, "confirm", t), "ada@example.com");
    assert.equal(readToken(SECRET, "unsubscribe", t), null, "a confirm link is not an unsubscribe link");
  });

  test("a wrong secret, a tampered address and junk are all refused", () => {
    const t = makeToken(SECRET, "confirm", "ada@example.com");
    assert.equal(readToken("another-secret-16-chars-long", "confirm", t), null);
    const [p, , exp, mac] = t.split(".");
    const forged = [p, Buffer.from("victim@example.com").toString("base64url"), exp, mac].join(".");
    assert.equal(readToken(SECRET, "confirm", forged), null, "the address is inside the signature");
    for (const junk of ["", "...", "a.b.c", "a.b.c.d", "x".repeat(400)]) {
      assert.equal(readToken(SECRET, "confirm", junk), null);
    }
  });

  test("confirm links expire; unsubscribe links do not", () => {
    const real = Date.now;
    try {
      const c = makeToken(SECRET, "confirm", "ada@example.com");
      const u = makeToken(SECRET, "unsubscribe", "ada@example.com");
      Date.now = () => real() + 8 * 86_400_000;
      assert.equal(readToken(SECRET, "confirm", c), null, "expired after 8 days");
      assert.equal(readToken(SECRET, "unsubscribe", u), "ada@example.com", "still works: an old newsletter must unsubscribe");
    } finally {
      Date.now = real;
    }
  });
});

for (const [label, make] of [["memory", async () => memoryStore()], ["postgres (PGlite)", pgStore]] as const) {
  describe(`mailing list — ${label}`, () => {
    test("subscribe → pending → confirm → confirmed, and unsubscribe removes", async () => {
      const store = await make();
      process.env.NEWSAI_MAIL_SECRET = SECRET;

      assert.equal((await (await post("/api/subscribe", { email: "Ada@Example.com" }, store)).json() as any).status, "new");
      assert.equal((await (await post("/api/subscribe", { email: "ada@example.com" }, store)).json() as any).status, "pending");
      assert.deepEqual(await store.pendingSubscribers(), ["ada@example.com"]);
      assert.deepEqual(await store.confirmedRecipients(), [], "unconfirmed addresses are never mailed the digest");

      const link = confirmUrl("", SECRET, "ada@example.com");
      const res = await get(link, store);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/);
      assert.deepEqual(await store.confirmedRecipients(), ["ada@example.com"]);
      assert.deepEqual(await store.pendingSubscribers(), []);

      assert.equal((await (await post("/api/subscribe", { email: "ada@example.com" }, store)).json() as any).status, "confirmed");

      const un = await get(unsubscribeUrl("", SECRET, "ada@example.com"), store);
      assert.equal(un.status, 200);
      assert.deepEqual(await store.confirmedRecipients(), [], "unsubscribed addresses stop receiving");
    });

    test("an invalid or forged link changes nothing", async () => {
      const store = await make();
      process.env.NEWSAI_MAIL_SECRET = SECRET;
      await post("/api/subscribe", { email: "ada@example.com" }, store);
      const res = await get("/api/mail/confirm?t=not-a-real-token", store);
      assert.equal(res.status, 400);
      assert.deepEqual(await store.confirmedRecipients(), [], "still not confirmed");
    });

    test("unsubscribing also switches the digest off on the matching account", async () => {
      const store = await make();
      process.env.NEWSAI_MAIL_SECRET = SECRET;
      await post("/api/auth/signup", { email: "ada@example.com", password: "correct horse battery" }, store);
      const user = await store.userByEmail("ada@example.com");
      await store.setPrefs(user!.id, { follows: [], digest: true });
      await get(unsubscribeUrl("", SECRET, "ada@example.com"), store);
      assert.equal((await store.userByEmail("ada@example.com"))!.digest, false);
    });

    test("an address that never confirms is mailed once, not once a day", async () => {
      const store = await make();
      await store.subscribe("ada@example.com");
      // Day one: the confirmation goes out.
      assert.equal(await store.claimSend(CONFIRM_CLAIM, "ada@example.com"), true);
      // Every day after: nothing, however many times the sender runs. Someone
      // who never confirmed has consented to nothing.
      for (const _day of ["2026-09-21", "2026-09-22", "2026-09-23"]) {
        assert.equal(await store.claimSend(CONFIRM_CLAIM, "ada@example.com"), false);
      }
      // Asking again from the site does not re-trigger it either.
      assert.equal(await store.subscribe("ada@example.com"), "pending");
      assert.equal(await store.claimSend(CONFIRM_CLAIM, "ada@example.com"), false);
    });

    test("unsubscribing and subscribing again earns a fresh confirmation", async () => {
      const store = await make();
      await store.subscribe("ada@example.com");
      assert.equal(await store.claimSend(CONFIRM_CLAIM, "ada@example.com"), true);
      await store.unsubscribe("ada@example.com");
      assert.equal(await store.subscribe("ada@example.com"), "new");
      assert.equal(await store.claimSend(CONFIRM_CLAIM, "ada@example.com"), true, "a real new subscription is confirmable again");
    });

    test("claimSend hands each address out exactly once, and releases on failure", async () => {
      const store = await make();
      assert.equal(await store.claimSend("2026-09-20", "ada@example.com"), true);
      assert.equal(await store.claimSend("2026-09-20", "ada@example.com"), false, "a re-run does not mail twice");
      assert.equal(await store.claimSend("2026-09-21", "ada@example.com"), true, "a different day is a different claim");
      await store.releaseSend("2026-09-20", "ada@example.com");
      assert.equal(await store.claimSend("2026-09-20", "ada@example.com"), true, "a failed send can be retried");
    });
  });
}

describe("no mail secret configured", () => {
  test("the links refuse rather than half-working", async () => {
    const store = memoryStore();
    const saved = process.env.NEWSAI_MAIL_SECRET;
    delete process.env.NEWSAI_MAIL_SECRET;
    try {
      assert.equal((await get("/api/mail/confirm?t=anything", store)).status, 400);
    } finally {
      if (saved) process.env.NEWSAI_MAIL_SECRET = saved;
    }
  });
});

const DIGEST: Digest = {
  date: "2026-09-20",
  generatedAt: "2026-09-20T01:40:00Z",
  stories: [
    {
      id: "gh:1", title: 'A framework & its "quirks" <script>alert(1)</script>', url: "https://example.com/a",
      source: "GitHub", publishedAt: "2026-09-20T00:00:00Z", signal: 3766,
      summary: "A repo.", why: "It matters.", tags: ["agents"], slug: "a-framework-1",
      analysis: { what: "w", soWhat: "s", caveats: "c", takeaways: ["t"] },
    },
    {
      id: "hn:2", title: "A second story", url: "https://example.com/b",
      source: "Hacker News", publishedAt: "2026-09-20T00:00:00Z", signal: 120,
      summary: "Another.", why: "", tags: ["models"],
    },
  ],
};

describe("email templates", () => {
  test("the digest carries both parts, links analysed stories to the site, and escapes titles", () => {
    const mail = digestEmail(DIGEST, "https://newsai.co.in", "https://newsai.co.in/api/mail/unsubscribe?t=x");
    assert.ok(mail.html.includes("https://newsai.co.in/story/a-framework-1/"), "analysed story links to its page");
    assert.ok(mail.html.includes("https://example.com/b"), "unanalysed story links to the source");
    assert.ok(!mail.html.includes("<script>alert(1)</script>"), "a hostile title cannot inject markup");
    assert.ok(mail.html.includes("&lt;script&gt;"), "it is escaped, not dropped");
    assert.ok(mail.html.includes("/api/mail/unsubscribe"), "every digest carries an unsubscribe link");
    assert.ok(mail.text.includes("Unsubscribe: "), "the text part has one too");
    assert.ok(mail.subject.length <= 120 && mail.subject.includes("2026"));
  });

  test("the confirmation email contains only the confirm link", () => {
    const mail = confirmEmail("https://newsai.co.in/api/mail/confirm?t=abc");
    assert.ok(mail.html.includes("/api/mail/confirm?t=abc"));
    assert.ok(mail.text.includes("/api/mail/confirm?t=abc"));
  });
});

describe("resend mailer", () => {
  function fakeFetch(status: number, seen: { body?: any }): typeof fetch {
    return (async (_url: string, init: RequestInit) => {
      seen.body = JSON.parse(String(init.body));
      return new Response(status === 200 ? "{}" : "nope", { status });
    }) as unknown as typeof fetch;
  }
  const mail: Mail = { to: "a@b.co", subject: "s", html: "<p>h</p>", text: "t", unsubscribeUrl: "https://x/u" };

  test("sends one-click unsubscribe headers, and throws on a provider error", async () => {
    const seen: { body?: any } = {};
    const m: Mailer = resendMailer("key", fakeFetch(200, seen));
    await m.send(mail);
    assert.deepEqual(seen.body.to, ["a@b.co"]);
    assert.equal(seen.body.headers["List-Unsubscribe"], "<https://x/u>");
    assert.equal(seen.body.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");

    const bad: Mailer = resendMailer("key", fakeFetch(422, {}));
    await assert.rejects(() => bad.send(mail), /resend 422/);
  });
});
