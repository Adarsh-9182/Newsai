/**
 * Not publishing the same thing twice.
 *
 * Two different problems wear the same name here. Within one run, several
 * sources carry the same story — a lab posts a release, HN links it, a repo
 * appears for it — and only one card should survive. Across runs, yesterday's
 * story is still in today's fetch, because a feed does not forget overnight
 * and an HN story keeps gaining points for days.
 *
 * The second is the one that kills a news site. A reader who sees Monday's
 * lead again on Tuesday stops trusting the page, so the published archive is
 * the authority: anything whose id or URL has already appeared is dropped
 * before the model ever sees it, which also means the same story is never
 * paid for twice.
 */

import { RawItem, Digest } from "./types.js";

/** Same page, written differently: tracking params, trailing slash, scheme. */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.protocol = "https:";
    u.hostname = u.hostname.replace(/^www\./, "");
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|ref|source|fbclid|gclid)/i.test(p)) u.searchParams.delete(p);
    }
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname}${path}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Titles that differ only in punctuation, case or an outlet's suffix. */
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’“”]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 9)
    .join(" ");
}

/**
 * Keeps the better copy of each story.
 *
 * "Better" is the one with the stronger signal, so when HN and a lab blog
 * both carry a release the version with real votes wins — and on a tie the
 * earlier-listed source wins, which is why sources are collected in order of
 * how primary they are.
 */
export function dedupeWithin(items: readonly RawItem[]): RawItem[] {
  const best = new Map<string, RawItem>();
  for (const item of items) {
    for (const key of [`u:${canonicalUrl(item.url)}`, `t:${titleKey(item.title)}`]) {
      const seen = best.get(key);
      if (!seen || item.signal > seen.signal) best.set(key, item);
    }
  }
  // A story reached under two keys is one story; collapse by id.
  const byId = new Map<string, RawItem>();
  for (const item of best.values()) byId.set(item.id, item);
  return [...byId.values()];
}

/** Drops anything the archive has already published. */
export function dropAlreadyPublished(items: readonly RawItem[], past: readonly Digest[]): RawItem[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  for (const d of past) {
    for (const s of d.stories) {
      seenIds.add(s.id);
      seenUrls.add(canonicalUrl(s.url));
      seenTitles.add(titleKey(s.title));
    }
  }
  return items.filter(
    (i) => !seenIds.has(i.id) && !seenUrls.has(canonicalUrl(i.url)) && !seenTitles.has(titleKey(i.title)),
  );
}
