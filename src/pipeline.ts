/**
 * One day's run: collect, drop what we have published, rank, summarise, write.
 *
 * The order matters and is the cost control. Deduplication happens before
 * summarising, and the cap is applied before summarising, so the model is
 * only ever shown stories that are new and that will actually be published.
 * Nothing is paid for that a reader will not see.
 *
 * Ranking uses source-normalized popularity, freshness, and a source cap.
 * The model never decides importance or compares stars with votes.
 */

import { Digest } from "./types.js";
import { LanguageModel, gemini } from "./llm.js";
import { collectAll } from "./sources/index.js";
import { dedupeWithin, dropAlreadyPublished } from "./dedupe.js";
import { summarise } from "./summarize.js";
import { analyseTop } from "./analyse.js";
import { readArchiveAll, writeDigest, today } from "./archive.js";
import { selectStories } from "./rank.js";
import { summaryModel, analysisModel, SUMMARY_PROMPT_VERSION, ANALYSIS_PROMPT_VERSION } from "./generation.js";
import { appendFile } from "node:fs/promises";

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

  const past = await readArchiveAll();
  const date = today();
  const published = past.find((d) => d.date === date && d.stories.length > 0);
  if (published) {
    console.log(`Already published ${published.stories.length} stories for ${date}; keeping this edition.`);
    return published;
  }

  console.log("Collecting…");
  const { items, failures, sourceCounts } = await collectAll();
  console.log(`  ${items.length} raw items`);

  const fresh = dedupeWithin(items);
  const unseen = dropAlreadyPublished(fresh, past);
  console.log(`  ${fresh.length} after dedupe, ${unseen.length} not yet published`);

  const chosen = selectStories(unseen, max);
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
    date,
    generatedAt: new Date().toISOString(),
    generation: {
      summaryModel: summaryModel(), analysisModel: analysisModel(),
      summaryPromptVersion: SUMMARY_PROMPT_VERSION, analysisPromptVersion: ANALYSIS_PROMPT_VERSION,
      sourceCounts, sourceFailures: failures.map((failure) => failure.split(":")[0]!),
      collected: items.length, selected: chosen.length, summarized: stories.length,
    },
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
  runPipeline().then(async (digest) => {
    if (process.env.GITHUB_STEP_SUMMARY) {
      const g = digest.generation;
      const summary = `## NewsAI edition ${digest.date}\n\nPublished stories: ${digest.stories.length}\n\n` +
        (g ? `Collected: ${g.collected}; selected: ${g.selected}; summarized: ${g.summarized}\n\nModels: ${g.summaryModel} / ${g.analysisModel}\n\n| Source | Items |\n|---|---:|\n${Object.entries(g.sourceCounts).map(([name, count]) => `| ${name} | ${count} |`).join("\n")}\n\nSource failures: ${g.sourceFailures.join(", ") || "none"}\n` : "Existing edition kept; no model calls were made.\n");
      await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
