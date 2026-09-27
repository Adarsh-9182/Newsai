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

import { RawItem, Digest } from "./types.js";
import { LanguageModel, gemini } from "./llm.js";
import { collectAll } from "./sources/index.js";
import { dedupeWithin, dropAlreadyPublished } from "./dedupe.js";
import { summarise } from "./summarize.js";
import { analyseTop } from "./analyse.js";
import { readArchive, writeDigest, today } from "./archive.js";

/** Hard ceiling on a run, so a busy news day cannot cost a surprising amount. */
const DEFAULT_MAX = 25;
/** How many of the day's stories get the long read. */
const DEFAULT_DEPTH = 5;

/** Environment overrides may lower spend, but never raise the published caps. */
function limit(name: string, fallback: number, maximum: number, minimum = 0): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return Math.min(value, maximum);
}

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

/**
 * A stable, readable URL for a story's own page.
 *
 * Derived from the title, suffixed with the item's id hash so two stories
 * that shorten to the same words never overwrite each other's page.
 */
function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 8)
    .join("-");
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return `${base || "story"}-${Math.abs(h).toString(36).slice(0, 5)}`;
}

export async function runPipeline(client?: LanguageModel): Promise<Digest> {
  // Initialize credentials before source collection so a misconfigured run
  // fails fast without publishing a blank digest.
  const model = client ?? gemini();

  const max = limit("NEWSAI_MAX_STORIES", DEFAULT_MAX, DEFAULT_MAX, 1);
  const depth = limit("NEWSAI_ANALYSIS_DEPTH", DEFAULT_DEPTH, DEFAULT_DEPTH);

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
  const { stories, usage } = await summarise(chosen, model);
  if (chosen.length > 0 && stories.length === 0) {
    throw new Error("All story summaries failed; refusing to publish an empty digest.");
  }

  console.log(`Analysing top ${Math.min(depth, stories.length)}…`);
  const { stories: deep, usage: analysisUsage } = await analyseTop(stories, depth, model);

  const digest: Digest = {
    date: today(),
    generatedAt: new Date().toISOString(),
    // Preserve the ranking the sources earned; the summariser may drop items
    // but must never reorder them.
    stories: deep.map((s) => ({ ...s, slug: slugify(s.title, s.id) })),
  };
  // No new stories is a quiet day, not a digest to publish. Keep the latest
  // actual edition on the site and let the workflow finish without a commit.
  if (digest.stories.length === 0) {
    console.log("No publishable stories today; leaving the archive unchanged.");
    return digest;
  }

  const path = await writeDigest(digest);

  const analysed = digest.stories.filter((s) => s.analysis).length;
  console.log(
    `Wrote ${digest.stories.length} stories (${analysed} analysed) to ${path}\n` +
      `  summarise: ${usage.requests} req · ${usage.inputTokens} in · ${usage.outputTokens} out\n` +
      `  analyse:   ${analysisUsage.requests} req · ${analysisUsage.inputTokens} in · ${analysisUsage.outputTokens} out`,
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
