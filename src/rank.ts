import { RawItem } from "./types.js";

/** Compare popularity within a source, then decay by age. Never equate stars with votes. */
export function selectStories(items: readonly RawItem[], max: number, now = Date.now()): RawItem[] {
  const peaks = new Map<string, number>();
  const signal = (i: RawItem) => Number.isFinite(i.signal) ? Math.max(0, i.signal) : 0;
  for (const item of items) peaks.set(item.source, Math.max(peaks.get(item.source) ?? 0, signal(item)));
  const score = (i: RawItem) => {
    const published = new Date(i.publishedAt).getTime();
    if (!Number.isFinite(published)) return 0;
    const age = Math.max(0, (now - published) / 3_600_000);
    const peak = peaks.get(i.source) ?? 0;
    const popularity = peak > 0 ? Math.log1p(signal(i)) / Math.log1p(peak) : 0;
    return (1 + popularity) * Math.exp(-age / 48);
  };
  const ranked = [...items].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const cap = Math.max(1, Math.ceil(max / 3));
  const counts = new Map<string, number>();
  const chosen: RawItem[] = [];
  const deferred: RawItem[] = [];
  for (const item of ranked) {
    if ((counts.get(item.source) ?? 0) >= cap) { deferred.push(item); continue; }
    if (chosen.length >= max) break;
    chosen.push(item);
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  }
  // A quiet day with only one source still gets a useful edition.
  chosen.push(...deferred.slice(0, Math.max(0, max - chosen.length)));
  return chosen.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}
