import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
