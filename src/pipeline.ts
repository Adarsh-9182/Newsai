/**
 * One day's run: collect, drop what we have published, rank, summarise, write.
 *
 * The order matters and is the cost control. Deduplication happens before
 * summarising, and the cap is applied before summarising, so the model is
 * only ever shown stories that are new and that will actually be published.
 * Nothing is paid for that a reader will not see.
 *
 * Ranking is done here rather than by the model: HN points and GitHub stars
 * are a measurement that already exists, and a model asked to score
 * importance would be guessing at it for money.
 */

import Anthropic from "@anthropic-ai/sdk";
import { RawItem, Digest } from "./types.js";
import { collectAll } from "./sources/index.js";
import { dedupeWithin, dropAlreadyPublished } from "./dedupe.js";
import { summarise } from "./summarize.js";
import { readArchive, writeDigest, today } from "./archive.js";

/** Hard ceiling on a run, so a busy news day cannot cost a surprising amount. */
const DEFAULT_MAX = 25;

/**
 * Recency decays the source's own signal rather than replacing it: a story
 * with 400 points from yesterday should still outrank a fresh one with 45,
 * but not forever.
 */
function rank(items: readonly RawItem[]): RawItem[] {
  const now = Date.now();
  return [...items].sort((a, b) => score(b) - score(a));

  function score(i: RawItem): number {
    const ageHours = Math.max(0, (now - new Date(i.publishedAt).getTime()) / 3_600_000);
    const freshness = Math.exp(-ageHours / 48);
    // A floor keeps arXiv, which has no votes, in the running on recency alone.
    return (i.signal + 25) * freshness;
  }
}

export async function runPipeline(client?: Anthropic): Promise<Digest> {
  const max = Number(process.env.NEWSAI_MAX_STORIES ?? DEFAULT_MAX);

  console.log("Collecting…");
  const { items } = await collectAll();
  console.log(`  ${items.length} raw items`);

  const fresh = dedupeWithin(items);
  const past = await readArchive();
  const unseen = dropAlreadyPublished(fresh, past);
  console.log(`  ${fresh.length} after dedupe, ${unseen.length} not yet published`);

  const chosen = rank(unseen).slice(0, max);
  if (chosen.length === 0) {
    console.log("Nothing new today.");
  }

  console.log(`Summarising ${chosen.length}…`);
  const { stories, usage } = await summarise(chosen, client);

  const digest: Digest = {
    date: today(),
    generatedAt: new Date().toISOString(),
    // Preserve the ranking the sources earned; the summariser may drop items
    // but must never reorder them.
    stories,
  };
  const path = await writeDigest(digest);

  console.log(
    `Wrote ${stories.length} stories to ${path}\n` +
      `  ${usage.requests} requests · ${usage.inputTokens} in · ${usage.outputTokens} out`,
  );
  return digest;
}

// Run when invoked directly, not when imported by a test.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  runPipeline().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
