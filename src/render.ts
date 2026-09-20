/**
 * The site: static HTML, generated from the archive.
 *
 * No framework and no client-side JavaScript, because this page is a list of
 * links and text. That choice is what makes hosting free and the page open
 * instantly on a phone on Indian mobile data, which is what most of the
 * audience will be reading it on.
 *
 * Dark by default with a light override, because the readers are developers
 * and it will mostly be opened at night.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { Digest, Story } from "./types.js";
import { readArchive } from "./archive.js";

const PUBLIC_DIR = new URL("../public/", import.meta.url).pathname;
const SITE = "newsai.co.in";
const TAGLINE = "AI news for Indian builders — agents first";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const prettyDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

const CSS = `
:root {
  --bg:#0b0d10; --card:#14171c; --line:#232830; --ink:#e8eaed;
  --dim:#9aa3ad; --accent:#7c9cff; --tag:#1d232e;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg:#fbfbfa; --card:#fff; --line:#e6e4e0; --ink:#1a1a18;
    --dim:#6b6b66; --accent:#3a5bd9; --tag:#f0efec;
  }
}
* { box-sizing:border-box; }
body {
  margin:0; background:var(--bg); color:var(--ink);
  font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.wrap { max-width:720px; margin:0 auto; padding:48px 16px 80px; }
header { margin-bottom:40px; }
h1 { font-size:26px; margin:0 0 6px; letter-spacing:-.02em; }
h1 a { color:var(--ink); text-decoration:none; }
.tagline { color:var(--dim); font-size:14px; margin:0; }
.date { color:var(--dim); font-size:13px; margin:36px 0 16px;
        text-transform:uppercase; letter-spacing:.08em; }
article {
  background:var(--card); border:1px solid var(--line); border-radius:10px;
  padding:18px 20px; margin-bottom:12px;
}
article h2 { font-size:17px; margin:0 0 8px; line-height:1.4; font-weight:600; }
article h2 a { color:var(--ink); text-decoration:none; }
article h2 a:hover { color:var(--accent); }
.summary { margin:0 0 10px; }
.why { margin:0 0 12px; color:var(--dim); font-size:15px; }
.why b { color:var(--accent); font-weight:600; }
.meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center;
        font-size:12px; color:var(--dim); }
.src { font-weight:600; }
.tag { background:var(--tag); border-radius:4px; padding:2px 7px; font-size:11px; }
footer { margin-top:56px; padding-top:20px; border-top:1px solid var(--line);
         color:var(--dim); font-size:13px; }
footer a { color:var(--accent); }
.empty { color:var(--dim); font-style:italic; }
`;

function card(s: Story): string {
  const tags = s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const signal = s.signal > 0 ? `<span>${s.signal} points</span>` : "";
  return `      <article>
        <h2><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a></h2>
        <p class="summary">${esc(s.summary)}</p>
        ${s.why ? `<p class="why"><b>Why it matters:</b> ${esc(s.why)}</p>` : ""}
        <div class="meta"><span class="src">${esc(s.source)}</span>${signal}${tags}</div>
      </article>`;
}

function day(d: Digest): string {
  const cards = d.stories.length
    ? d.stories.map(card).join("\n")
    : `      <p class="empty">Nothing new worth publishing.</p>`;
  return `      <p class="date">${esc(prettyDate(d.date))}</p>\n${cards}`;
}

function page(digests: readonly Digest[]): string {
  const latest = digests[0];
  const desc = latest
    ? `${latest.stories.length} things that happened in AI on ${prettyDate(latest.date)}.`
    : TAGLINE;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${SITE} — ${esc(TAGLINE)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${SITE}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<style>${CSS}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1><a href="/">${SITE}</a></h1>
      <p class="tagline">${esc(TAGLINE)}</p>
    </header>
${digests.map(day).join("\n")}
    <footer>
      Assembled daily from arXiv, Hacker News, GitHub and lab blogs.
      Summaries are written by a language model from each item's own title and
      abstract, and can be wrong — follow the link before you rely on anything.
    </footer>
  </div>
</body>
</html>
`;
}

/** How many days the front page carries. Older days stay in data/. */
const DAYS_ON_PAGE = 7;

export async function render(): Promise<void> {
  const digests = await readArchive(DAYS_ON_PAGE);
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(`${PUBLIC_DIR}index.html`, page(digests), "utf8");
  const count = digests.reduce((n, d) => n + d.stories.length, 0);
  console.log(`Rendered ${digests.length} day(s), ${count} stories → public/index.html`);
}

if (process.argv[1]?.endsWith("render.js")) {
  render().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
