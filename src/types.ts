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
}

/** One day's published output. Written to data/YYYY-MM-DD.json and committed. */
export interface Digest {
  readonly date: string;
  readonly generatedAt: string;
  readonly stories: readonly Story[];
}
