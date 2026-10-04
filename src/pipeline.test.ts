import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Digest } from "./types.js";

test("rerunning a published day preserves its edition without source or model requests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "newsai-rerun-"));
  const previousDir = process.env.NEWSAI_DATA_DIR;
  const originalFetch = globalThis.fetch;
  const date = new Date().toISOString().slice(0, 10);
  const edition = {
    date, generatedAt: `${date}T01:40:00Z`,
    stories: [{
      id: "existing:1", title: "Previously published story", url: "https://example.com/story",
      source: "GitHub", publishedAt: `${date}T01:00:00Z`, signal: 10,
      summary: "Existing summary", why: "Existing context", tags: ["agents"], slug: "existing-story",
    }],
  };
  const path = join(dir, `${date}.json`);
  const content = JSON.stringify(edition, null, 2) + "\n";
  await writeFile(path, content);
  process.env.NEWSAI_DATA_DIR = dir;
  let fetches = 0;
  globalThis.fetch = (async () => { fetches++; throw new Error("Unexpected source request"); }) as typeof fetch;
  try {
    const { runPipeline } = await import("./pipeline.js");
    const result = await runPipeline({ generate: async () => { throw new Error("Unexpected model request"); } });
    assert.deepEqual(result, edition);
    assert.equal(fetches, 0);
    assert.equal(await readFile(path, "utf8"), content);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousDir === undefined) delete process.env.NEWSAI_DATA_DIR;
    else process.env.NEWSAI_DATA_DIR = previousDir;
    await rm(dir, { recursive: true, force: true });
  }
});

test("bounded archive reads coexist with full history for rendering and dedupe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "newsai-history-"));
  try {
    const date = new Date(Date.now() - 800 * 86_400_000);
    const edition: Digest = { date: "", generatedAt: "", stories: [] };
    for (let i = 0; i < 405; i++) {
      const day = new Date(date.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      await writeFile(join(dir, `${day}.json`), JSON.stringify({ ...edition, date: day, stories: [] }));
    }
    const { readArchive, readArchiveAll } = await import("./archive.js");
    assert.equal((await readArchive(400, dir)).length, 400, "recent views can request a bounded window");
    const complete = await readArchiveAll(dir);
    assert.equal(complete.length, 405, "pipeline reads older editions for dedupe");
    assert.ok(complete[404]!.date < complete[399]!.date, "the oldest edition remains available to dedupe");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
