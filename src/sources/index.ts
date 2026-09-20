/**
 * Collecting from every source, tolerantly.
 *
 * Sources fail. arXiv goes down, a blog changes its feed, GitHub rate limits
 * an anonymous request. None of that should cost the day's digest, so every
 * source is awaited independently and a failure is reported and skipped.
 *
 * The run only fails when *everything* failed, because publishing an empty
 * day silently is worse than not publishing: an empty page looks like there
 * was no AI news, which is never true.
 */

import { RawItem } from "../types.js";
import { fetchArxiv } from "./arxiv.js";
import { fetchHackerNews } from "./hackernews.js";
import { fetchGithub } from "./github.js";
import { fetchFeed, FEEDS } from "./blogs.js";

export interface Collection {
  readonly items: readonly RawItem[];
  /** Named so a broken source is visible in the log rather than just missing. */
  readonly failures: readonly string[];
}

export async function collectAll(): Promise<Collection> {
  const jobs: ReadonlyArray<readonly [string, Promise<RawItem[]>]> = [
    ["arXiv", fetchArxiv()],
    ["Hacker News", fetchHackerNews()],
    ["GitHub", fetchGithub()],
    ...FEEDS.map((f) => [f.name, fetchFeed(f)] as const),
  ];

  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const items: RawItem[] = [];
  const failures: string[] = [];

  settled.forEach((r, i) => {
    const name = jobs[i]?.[0] ?? "unknown";
    if (r.status === "fulfilled") {
      items.push(...r.value);
      console.log(`  ${name}: ${r.value.length}`);
    } else {
      failures.push(`${name}: ${r.reason}`);
      console.warn(`  ${name}: FAILED — ${r.reason}`);
    }
  });

  if (items.length === 0) {
    throw new Error(`every source failed:\n${failures.join("\n")}`);
  }
  return { items, failures };
}
