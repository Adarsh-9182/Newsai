/**
 * Lab and company blogs — the primary sources.
 *
 * When a lab announces something, this is where it is announced. Everything
 * else on the internet that day is a summary of one of these posts, so
 * reading them directly is the difference between reporting a release and
 * reporting someone's tweet about a release.
 *
 * Feeds are read tolerantly and independently: a lab that redesigns its blog
 * and breaks its feed costs that lab for a day and nothing else.
 *
 * Anthropic and Meta AI are missing on purpose: neither publishes a public
 * feed at the usual paths (every candidate returned 404 when this was built).
 * Their releases still arrive here via Hacker News. Do not add a guessed URL
 * back — a source that fails every run trains you to ignore the failure log.
 */

import { RawItem } from "../types.js";
import { blocks, text, attr } from "../xml.js";

interface Feed {
  readonly name: string;
  readonly url: string;
}

/**
 * Add to this list rather than writing another source file — anything that
 * publishes Atom or RSS already works.
 */
export const FEEDS: readonly Feed[] = [
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/" },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
  { name: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/feed/" },
  { name: "Together AI", url: "https://www.together.ai/blog/rss.xml" },
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
];

/**
 * How far back a post can be and still count as news.
 *
 * Ten days, not the two or three that "news" suggests. Labs publish weekly at
 * best, and a window tight enough to feel current silently emptied every blog
 * source — the feeds returned fine and every post was one day too old. A
 * generous window costs a little repetition, which the deduper already
 * handles; a tight one costs the primary sources entirely.
 */
const MAX_AGE_DAYS = 10;

export async function fetchFeed(feed: Feed): Promise<RawItem[]> {
  const res = await fetch(feed.url, { headers: { "User-Agent": "newsai.co.in (daily digest)" } });
  if (!res.ok) throw new Error(`${feed.name} ${res.status}`);
  const xml = await res.text();

  // Atom calls them <entry>, RSS calls them <item>. Read whichever is there.
  const entries = [...blocks(xml, "entry"), ...blocks(xml, "item")];
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;

  return entries.flatMap((e): RawItem[] => {
    const title = text(e, "title");
    const link = attr(e, "link", "href") || text(e, "link") || text(e, "guid");
    if (!title || !link) return [];

    const when = text(e, "published") || text(e, "updated") || text(e, "pubDate");
    const at = when ? new Date(when) : new Date();
    // An undated post is assumed current rather than dropped; a feed that
    // omits dates is still worth reading.
    if (!Number.isNaN(at.getTime()) && at.getTime() < cutoff) return [];

    const body = text(e, "summary") || text(e, "description") || text(e, "content");
    return [
      {
        id: `blog:${feed.name}:${link}`,
        title,
        url: link,
        source: feed.name,
        publishedAt: Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString(),
        // A lab post is news because of who published it, not how many people
        // voted. Give it a floor so it ranks above an unremarkable HN story.
        signal: 60,
        ...(body ? { text: body.slice(0, 1200) } : {}),
      },
    ];
  });
}
