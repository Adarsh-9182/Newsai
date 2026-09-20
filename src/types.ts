/**
 * What flows through the pipeline.
 *
 * A RawItem is something a source found. A Story is a RawItem the model has
 * read and placed. Nothing between the two stages invents a fact: the
 * summariser is given the title and abstract and asked to compress them, so
 * every claim on the site traces back to a fetched document.
 */

/** Something a source found, before the model has seen it. */
export interface RawItem {
  /** Stable across runs, so the same story is never published twice. */
  readonly id: string;
  readonly title: string;
  readonly url: string;
  /** Which source produced it — shown on the card, and used for weighting. */
  readonly source: string;
  /** ISO date. Sources that only give a day get midnight UTC. */
  readonly publishedAt: string;
  /**
   * How much the source's own audience cared: HN points, GitHub stars.
   * Sources without a popularity signal report 0 and are ranked by recency.
   */
  readonly signal: number;
  /** Abstract, blurb or description. The summariser's only evidence. */
  readonly text?: string;
}

/** A RawItem the model has summarised. */
export interface Story extends RawItem {
  /** One or two sentences, plain language. */
  readonly summary: string;
  /** Why a builder should care. The line that makes the site worth reading. */
  readonly why: string;
  readonly tags: readonly string[];
  /** Slug for this story's own page. Absent until the story is written out. */
  readonly slug?: string;
  /** Present only on the few stories that earned a full read. */
  readonly analysis?: Analysis;
}

/**
 * The long read, for the handful of stories a day that deserve one.
 *
 * Depth is rationed on purpose. Twenty-five paragraphs of analysis a day is
 * both expensive and unreadable, and most days genuinely contain three or
 * four things that matter. The rest earn a line. What separates the two is
 * the same ranking that orders the page — the sources' own signal — so the
 * choice is measured rather than guessed at.
 */
export interface Analysis {
  /** 2-4 sentences: what was actually built, measured or announced. */
  readonly what: string;
  /** 2-4 sentences: what it changes for someone building with this. */
  readonly soWhat: string;
  /** What the item does NOT establish. The section that keeps us honest. */
  readonly caveats: string;
  /** 2-4 short lines a reader could act on, or an empty list. */
  readonly takeaways: readonly string[];
}

/** One day's published output. Written to data/YYYY-MM-DD.json and committed. */
export interface Digest {
  readonly date: string;
  readonly generatedAt: string;
  readonly stories: readonly Story[];
}
