/**
 * The shell every page shares, and the small pieces the pages are built from.
 *
 * Everything here returns a string. There is no templating engine because the
 * output is a few dozen pages of HTML with no logic in the markup, and a
 * dependency would be more code than the functions it replaced.
 */

import { CSS, FONTS_HREF } from "./styles.js";
import { Story } from "../types.js";

export const SITE_NAME = "newsai";
export const TAGLINE = "AI news, analysed — agents first";

/**
 * Absolute base for canonical links, the sitemap and the feed.
 *
 * The domain is not bought yet, so this resolves in order: an explicit
 * NEWSAI_SITE_URL, Vercel's production URL when building there, then the
 * intended domain. Once newsai.co.in is attached in Vercel the second source
 * updates itself and nothing here needs editing.
 */
export const SITE_URL = (
  process.env.NEWSAI_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://newsai.co.in")
).replace(/\/$/, "");

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Only http(s) links leave this site as a link.
 *
 * esc() stops a value breaking out of its attribute, but it does nothing about
 * what the attribute *says*: `javascript:alert(1)` survives escaping intact
 * and runs on click. Story URLs come from feeds and submissions this project
 * does not control, so the scheme is checked at the point of rendering. Anything
 * else becomes "#", which is inert and visibly wrong rather than dangerous.
 */
export const safeUrl = (raw: string): string => {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "#";
  } catch {
    return "#";
  }
};

export const longDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

export const shortDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Never the story's own text as HTML: every dynamic value goes through esc(). */
export const tagPill = (t: string): string => `<a class="tag ${esc(t)}" href="/tag/${esc(t)}/">${esc(t)}</a>`;

export interface PageOpts {
  readonly title: string;
  readonly description: string;
  /** Path beginning with "/", used for the canonical link and the nav state. */
  readonly path: string;
  readonly body: string;
  readonly type?: "website" | "article";
}

const NAV: ReadonlyArray<readonly [string, string]> = [
  ["/", "today"],
  ["/archive/", "archive"],
  ["/about/", "method"],
];

export function shell(o: PageOpts): string {
  const fullTitle = o.path === "/" ? `${SITE_NAME} — ${TAGLINE}` : `${o.title} — ${SITE_NAME}`;
  const url = `${SITE_URL}${o.path}`;
  const nav = NAV.map(
    ([href, label]) => `<li><a href="${href}"${href === o.path ? ' class="on"' : ""}>${label}</a></li>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="/feed.xml">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:type" content="${o.type ?? "website"}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#141414">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_HREF}">
<style>${CSS}</style>
</head>
<body>
<nav class="top"><div class="wrap in">
  <a class="brand" href="/"><i></i>${SITE_NAME}<small>.co.in</small></a>
  <ul>${nav}</ul>
  <span class="live">daily · 07:00 IST</span>
</div></nav>
${o.body}
<footer class="site"><div class="wrap in">
  <p>Assembled daily from arXiv, Hacker News, GitHub and lab blogs. Summaries and analysis are
  written by a language model from each item's own title and abstract &mdash; it has not read the
  linked page &mdash; and can be wrong. Follow the link before you rely on anything.
  <a href="/about/">How it works</a>.</p>
  <p><a href="/feed.xml">RSS</a> &middot; <a href="/archive/">Archive</a></p>
</div></footer>
</body>
</html>
`;
}

/** A story as a card. Analysed stories say so, and link to their own page. */
export function card(s: Story): string {
  const deep = s.analysis && s.slug;
  const href = deep ? `/story/${s.slug}/` : safeUrl(s.url);
  const ext = deep ? "" : ' rel="noopener noreferrer" target="_blank"';
  const tags = s.tags.map(tagPill).join("");
  return `<article class="card rise">
  <div class="foot" style="margin:0"><span class="k">${esc(s.source)}</span>${
    s.signal > 0 ? `<span class="sig">${s.signal.toLocaleString("en-IN")} ${s.source === "GitHub" ? "stars" : "pts"}</span>` : ""
  }${deep ? '<span class="tag deep">analysis</span>' : ""}</div>
  <h3><a href="${esc(href)}"${ext}>${esc(s.title)}</a></h3>
  <p>${esc(s.summary)}</p>
  ${s.why ? `<p class="why">${esc(s.why)}</p>` : ""}
  ${tags ? `<div class="foot">${tags}</div>` : ""}
</article>`;
}
