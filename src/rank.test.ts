import test from "node:test";
import assert from "node:assert/strict";
import { selectStories } from "./rank.js";
import { RawItem } from "./types.js";

const now = Date.parse("2026-10-03T07:00:00Z");
const item = (id: string, source: string, signal: number, hours = 0): RawItem => ({
  id, source, signal, title: id, url: `https://example.com/${id}`, publishedAt: new Date(now - hours * 3_600_000).toISOString(),
});
test("busy GitHub source cannot crowd research and lab updates out of the edition", () => {
  const repos = Array.from({ length: 10 }, (_, n) => item(`gh:${n}`, "GitHub", 10_000 - n));
  const stories = selectStories([...repos, item("paper", "arXiv", 0), item("lab", "OpenAI", 0), item("hn", "Hacker News", 100)], 6, now);
  assert.equal(stories.length, 6);
  assert.equal(stories.filter((s) => s.source === "GitHub").length, 3, "only backfill after including all available sources");
  for (const id of ["paper", "lab", "hn"]) assert.ok(stories.some((s) => s.id === id));
});
test("popularity units are normalized and recency still matters", () => {
  const a = item("a", "GitHub", 10_000);
  const b = item("b", "Hacker News", 100);
  assert.deepEqual(selectStories([b, a], 2, now).map((s) => s.id), ["a", "b"]);
  const stale = item("stale", "GitHub", 1_000_000, 240);
  assert.equal(selectStories([stale, item("fresh", "arXiv", 0)], 1, now)[0]!.id, "fresh");
});
