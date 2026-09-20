/**
 * Hacker News — what builders actually read today.
 *
 * Via Algolia's search API because it takes a score filter server-side: the
 * front page is mostly not AI, and fetching it all to discard 90% wastes a
 * request and a rate limit. The points floor is the whole point of this
 * source — HN's vote is the closest thing to a free relevance signal, and
 * anything under it is noise the site does not need.
 */

import { RawItem } from "../types.js";

const ENDPOINT = "https://hn.algolia.com/api/v1/search_by_date";
/** Below this, a story has not cleared HN's own bar. */
const MIN_POINTS = 40;

interface Hit {
  objectID: string;
  title: string | null;
  url: string | null;
  points: number | null;
  created_at: string;
  story_text: string | null;
}

export async function fetchHackerNews(hoursBack = 36): Promise<RawItem[]> {
  const since = Math.floor(Date.now() / 1000) - hoursBack * 3600;
  const url =
    `${ENDPOINT}?query=AI&tags=story` +
    `&numericFilters=created_at_i>${since},points>${MIN_POINTS}&hitsPerPage=40`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN ${res.status}`);
  const data = (await res.json()) as { hits?: Hit[] };

  return (data.hits ?? []).flatMap((h): RawItem[] => {
    if (!h.title) return [];
    // A self-post has no url; link the discussion instead of dropping it.
    const link = h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`;
    return [
      {
        id: `hn:${h.objectID}`,
        title: h.title,
        url: link,
        source: "Hacker News",
        publishedAt: h.created_at,
        signal: h.points ?? 0,
        ...(h.story_text ? { text: h.story_text.slice(0, 800) } : {}),
      },
    ];
  });
}
