/**
 * Just enough XML to read Atom and RSS.
 *
 * A dependency-free reader, because the two feeds this project consumes
 * (arXiv's Atom, a handful of lab blogs) are machine-generated and
 * well-formed. It is deliberately tolerant: a feed that changes shape should
 * cost us that feed for a day, not crash the run.
 *
 * This is not a general XML parser and should not become one. If a feed
 * appears that this cannot read, add the dependency rather than the special
 * case.
 */

/** Splits a document into the contents of each <tag>...</tag>. */
export function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[1] ?? "");
}

/** First <tag>value</tag> inside a block, unescaped and trimmed. */
export function text(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? unescapeXml(stripTags(m[1] ?? "")).replace(/\s+/g, " ").trim() : "";
}

/** An attribute off the first matching self-closing or open tag. */
export function attr(block: string, tag: string, name: string): string {
  const m = block.match(new RegExp(`<${tag}\\s[^>]*${name}="([^"]*)"`, "i"));
  return m ? unescapeXml(m[1] ?? "") : "";
}

const stripTags = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ");

export function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
