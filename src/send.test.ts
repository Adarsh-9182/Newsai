import test from "node:test";
import assert from "node:assert/strict";
import { send } from "./send.js";
import { memoryStore } from "./server/store/memory.js";
import { CONFIRM_CLAIM } from "./server/types.js";
import { Digest } from "./types.js";

const digest: Digest = { date: "2026-10-04", generatedAt: "2026-10-04T01:30:00Z", stories: [{
  id: "x", title: "Story", url: "https://example.com", source: "test", publishedAt: "2026-10-04T00:00:00Z", signal: 0,
  summary: "Summary", why: "", tags: [],
}] };
const secret = "test-secret-with-at-least-16-chars";

test("sender dry-run previews email without marking confirmations or digests delivered", async () => {
  const store = memoryStore();
  await store.subscribe("pending@example.com");
  await store.subscribe("confirmed@example.com");
  await store.confirmSubscriber("confirmed@example.com");
  let previews = 0;
  const result = await send(digest.date, { store, secret, digest, dryRun: true, gapMs: 0, mailer: { name: "test", send: async () => { previews++; } } });
  assert.equal(previews, 2);
  assert.equal(result.sent, 0);
  assert.equal(result.previewed, 2);
  assert.equal(await store.claimSend(CONFIRM_CLAIM, "pending@example.com"), true);
  assert.equal(await store.claimSend(digest.date, "confirmed@example.com"), true);
});

test("sender reports confirmation failures without a digest and leaves them retryable", async () => {
  const store = memoryStore();
  await store.subscribe("pending@example.com");
  const result = await send("1900-01-01", { store, secret, gapMs: 0, mailer: { name: "test", send: async () => { throw new Error("Provider failed"); } } });
  assert.equal(result.failed, 1);
  assert.equal(await store.claimSend(CONFIRM_CLAIM, "pending@example.com"), true);
});
