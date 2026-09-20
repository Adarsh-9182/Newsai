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
  /** Account pages are private and per-user: keep them out of search indexes. */
  readonly noindex?: boolean;
}

const NAV: ReadonlyArray<readonly [string, string]> = [
  ["/", "today"],
  ["/archive/", "archive"],
  ["/about/", "method"],
];

const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
} as const;
export const icon = (name: keyof typeof ICON): string => ICON[name];

/**
 * A save button. It carries the story's own fields as data attributes so the
 * script can send them without a lookup — the archive is static files, so
 * there is nothing to look up. Without JavaScript it is a link to sign in,
 * because saving needs an account and a static page cannot know who is looking.
 */
export const saveButton = (s: Story): string =>
  `<button class="save" type="button" aria-pressed="false" aria-label="Save story" title="Save" data-id="${esc(s.id)}" data-title="${esc(s.title)}" data-url="${esc(safeUrl(s.url))}" data-source="${esc(s.source)}" data-slug="${esc(s.slug ?? "")}">${ICON.bookmark}</button>`;

export function shell(o: PageOpts): string {
  const fullTitle = o.path === "/" ? `${SITE_NAME} — ${TAGLINE}` : `${o.title} — ${SITE_NAME}`;
  const url = `${SITE_URL}${o.path}`;
  const nav = NAV.map(
    ([href, label]) => `<li><a href="${href}"${href === o.path ? ' class="on"' : ""}>${label}</a></li>`,
  ).join("");

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(url)}">
${o.noindex ? '<meta name="robots" content="noindex">\n' : ""}<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="/feed.xml">
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
<script src="/theme.js"></script>
</head>
<body>
<div class="bg" aria-hidden="true"><i></i><i></i><i></i></div>
<nav class="top"><div class="wrap in">
  <a class="brand" href="/"><i></i>${SITE_NAME}<small>.co.in</small></a>
  <ul>${nav}</ul>
  <div class="nav-r">
    <button class="searchbtn" type="button" data-open-palette aria-label="Search">${ICON.search}<span>Search stories…</span><kbd>⌘K</kbd></button>
    <button class="iconbtn" type="button" data-theme-toggle aria-label="Toggle theme">${ICON.theme}</button>
    <div id="auth"><a class="btn sm" href="/login/">Sign in</a><a class="btn sm primary" href="/signup/">Get started</a></div>
  </div>
</div></nav>
${o.body}
<footer class="site"><div class="wrap in">
  <div>
    <a class="brand" href="/" style="margin-bottom:14px"><i></i>${SITE_NAME}<small>.co.in</small></a>
    <p>Assembled daily from arXiv, Hacker News, GitHub and lab blogs. Summaries and analysis are
    written by a language model from each item's own title and abstract &mdash; it has not read the
    linked page &mdash; and can be wrong. Follow the link before you rely on anything.</p>
  </div>
  <nav aria-label="Footer">
    <div><b>Read</b><a href="/">Today</a><a href="/archive/">Archive</a><a href="/tag/agents/">Agents</a><a href="/feed.xml">RSS</a></div>
    <div><b>About</b><a href="/about/">How it works</a><a href="/sitemap.xml">Sitemap</a></div>
    <div><b>Account</b><a href="/login/">Sign in</a><a href="/signup/">Create account</a><a href="/account/">Saved stories</a></div>
  </nav>
</div></footer>
<div class="pal" id="palette" role="dialog" aria-modal="true" aria-label="Search" hidden>
  <div class="pal-box">
    <input id="pal-input" type="text" placeholder="Search stories, tags and pages…" autocomplete="off" spellcheck="false" aria-controls="pal-list">
    <ul class="pal-list" id="pal-list" role="listbox"></ul>
    <div class="pal-foot"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></div>
  </div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/app.js" defer></script>
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
  return `<article class="card spot" data-tags="${esc(s.tags.join(" "))}">
  ${saveButton(s)}
  <div class="foot" style="margin:0"><span class="k">${esc(s.source)}</span>${
    s.signal > 0 ? `<span class="sig">${s.signal.toLocaleString("en-IN")} ${s.source === "GitHub" ? "stars" : "pts"}</span>` : ""
  }${deep ? '<span class="tag deep">analysis</span>' : ""}</div>
  <h3><a href="${esc(href)}"${ext}>${esc(s.title)}</a></h3>
  <p>${esc(s.summary)}</p>
  ${s.why ? `<p class="why">${esc(s.why)}</p>` : ""}
  ${tags ? `<div class="foot">${tags}</div>` : ""}
</article>`;
}
