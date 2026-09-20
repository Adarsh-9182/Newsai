/**
 * arXiv — the research half of the site.
 *
 * Queried by category rather than keyword: cs.AI, cs.LG, cs.CL and cs.MA are
 * where agent and model work lands, and a category query returns the whole
 * day rather than whatever matched a phrase.
 *
 * arXiv has no popularity signal — a paper is hours old and nobody has voted
 * on it yet — so everything here reports signal 0 and competes on recency and
 * on what the summariser makes of the abstract. That is the intended shape:
 * papers are the part of this site a reader cannot get from Twitter.
 */

import { RawItem } from "../types.js";
import { blocks, text, attr } from "../xml.js";

const CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.MA"] as const;
const ENDPOINT = "http://export.arxiv.org/api/query";

export async function fetchArxiv(max = 40): Promise<RawItem[]> {
  const query = CATEGORIES.map((c) => `cat:${c}`).join("+OR+");
  const url =
    `${ENDPOINT}?search_query=${query}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${max}`;

  const res = await fetch(url, { headers: { "User-Agent": "newsai.co.in (daily digest)" } });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const xml = await res.text();

  return blocks(xml, "entry").flatMap((entry): RawItem[] => {
    const id = text(entry, "id");
    const title = text(entry, "title");
    if (!id || !title) return [];
    // The <id> is the abs URL; prefer the alternate link when arXiv gives one.
    const link = attr(entry, "link", "href") || id;
    return [
      {
        id: `arxiv:${id.split("/").pop()}`,
        title,
        url: link,
        source: "arXiv",
        publishedAt: text(entry, "published") || new Date().toISOString(),
        signal: 0,
        text: text(entry, "summary").slice(0, 1200),
      },
    ];
  });
}
