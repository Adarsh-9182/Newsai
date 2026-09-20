/**
 * The pages. Each is a pure function from the archive to a string, which is
 * what makes the whole site testable without a browser and rebuildable from
 * `data/` alone.
 */

import { Digest, Story } from "../types.js";
import { shell, card, esc, longDate, shortDate, tagPill, safeUrl, SITE_URL, SITE_NAME, TAGLINE } from "./layout.js";

export const ALL_TAGS = ["agents", "research", "models", "tools", "infra", "funding", "policy", "india"] as const;

const flat = (ds: readonly Digest[]): Story[] => ds.flatMap((d) => [...d.stories]);

function chips(active?: string): string {
  const one = (href: string, label: string, on: boolean) =>
    `<a class="chip${on ? " on" : ""}" href="${href}">${label}</a>`;
  return `<div class="chips">${one("/", "all", !active)}${ALL_TAGS.map((t) => one(`/tag/${t}/`, t, t === active)).join("")}</div>`;
}

function lead(s: Story): string {
  const deep = s.analysis && s.slug;
  const href = deep ? `/story/${s.slug}/` : safeUrl(s.url);
  return `<a class="lead rise" href="${esc(href)}"${deep ? "" : ' rel="noopener noreferrer" target="_blank"'}>
  <div class="kicker"><span class="k">${esc(s.source)}</span>${deep ? '<span class="tag deep">analysis</span>' : ""}${s.tags
    .slice(0, 2)
    .map((t) => `<span class="tag ${esc(t)}">${esc(t)}</span>`)
    .join("")}</div>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.summary)}</p>
  <span class="go">${deep ? "read the analysis →" : "open source →"}</span>
</a>`;
}

/** The front page: hero, the lead, today's grid, then recent days. */
export function home(digests: readonly Digest[]): string {
  const today = digests[0];
  const stories = today?.stories ?? [];
  const [first, ...rest] = stories;
  const deepCount = stories.filter((s) => s.analysis).length;
  const sources = new Set(flat(digests).map((s) => s.source)).size;

  const older = digests
    .slice(1)
    .map(
      (d) => `<div class="dayhead"><h2><a href="/day/${esc(d.date)}/">${esc(longDate(d.date))}</a></h2><span>${d.stories.length} stories</span></div>
<div class="grid">${d.stories.map(card).join("\n")}</div>`,
    )
    .join("\n");

  const body = `<main class="wrap">
  <section class="hero">
    <p class="eyebrow rise">// ${today ? esc(shortDate(today.date)) : "soon"} &middot; daily digest</p>
    <h1 class="rise">Everything in AI, <em>actually analysed.</em></h1>
    <p class="lede rise">Papers, releases and agent tooling from arXiv, Hacker News, GitHub and the labs &mdash;
    ranked by what people really read, with an honest note on what each one doesn't prove.</p>
    <div class="stats rise">
      <div><b>${stories.length}</b><span>today</span></div>
      <div><b>${deepCount}</b><span>deep reads</span></div>
      <div><b>${sources}</b><span>sources</span></div>
      <div><b>${digests.length}</b><span>days</span></div>
    </div>
  </section>
  <div class="bar"><h2>${today ? esc(longDate(today.date)) : "Today"}</h2>${chips()}</div>
  ${first ? lead(first) : '<p class="empty">No digest yet &mdash; the first run publishes at 07:00 IST.</p>'}
  ${rest.length ? `<div class="grid">${rest.map(card).join("\n")}</div>` : ""}
  ${older}
</main>`;

  return shell({
    title: SITE_NAME,
    description: today
      ? `${stories.length} things in AI on ${longDate(today.date)}, with analysis of the ${deepCount} that matter.`
      : TAGLINE,
    path: "/",
    body,
  });
}

/** One analysed story, as its own page. */
export function storyPage(s: Story, date: string): string {
  const a = s.analysis;
  if (!a || !s.slug) throw new Error(`storyPage needs an analysed, slugged story: ${s.id}`);

  const body = `<main class="narrow"><article class="story">
  <a class="crumb" href="/">&larr; today</a>
  <div class="foot" style="display:flex;gap:8px;flex-wrap:wrap">${s.tags.map(tagPill).join("")}</div>
  <h1>${esc(s.title)}</h1>
  <div class="meta"><span>${esc(s.source)}</span><span>${esc(longDate(date))}</span>${
    s.signal > 0 ? `<span>${s.signal.toLocaleString("en-IN")} ${s.source === "GitHub" ? "stars" : "points"}</span>` : ""
  }</div>
  <p class="tldr">${esc(s.summary)}</p>
  <section class="sec what"><h2>What happened</h2><p>${esc(a.what)}</p></section>
  <section class="sec sowhat"><h2>Why it matters</h2><p>${esc(a.soWhat)}</p></section>
  <section class="sec caveats"><h2>What this doesn't show</h2><p>${esc(a.caveats)}</p></section>
  ${
    a.takeaways.length
      ? `<section class="sec take"><h2>Takeaways</h2><ul>${a.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`
      : ""
  }
  <a class="src-btn" href="${esc(safeUrl(s.url))}" rel="noopener noreferrer" target="_blank">read the original &nearr;</a>
  <p class="note">// Written by a language model from the title and abstract above. It has not read the
  linked page. The "doesn't show" section exists because a summary can only be as good as what it was
  shown &mdash; verify at the source.</p>
</article></main>`;

  return shell({
    title: s.title,
    description: s.summary,
    path: `/story/${s.slug}/`,
    body,
    type: "article",
  });
}

/** Every story carrying one tag, newest first. */
export function tagPage(tag: string, digests: readonly Digest[]): string {
  const items = flat(digests).filter((s) => s.tags.includes(tag));
  const body = `<main class="wrap">
  <section class="hero" style="padding-bottom:16px">
    <p class="eyebrow">// tag</p>
    <h1 style="font-size:clamp(34px,6vw,56px)">${esc(tag)}</h1>
    <p class="lede">${items.length} ${items.length === 1 ? "story" : "stories"} across the archive.</p>
  </section>
  <div class="bar"><h2>filter</h2>${chips(tag)}</div>
  ${items.length ? `<div class="grid">${items.map(card).join("\n")}</div>` : '<p class="empty">Nothing tagged this yet.</p>'}
</main>`;
  return shell({ title: `#${tag}`, description: `AI stories tagged ${tag}.`, path: `/tag/${tag}/`, body });
}

/** Every day ever published — the page that makes the archive browsable. */
export function archivePage(digests: readonly Digest[]): string {
  const rows = digests
    .map(
      (d) => `<a class="card" href="/day/${esc(d.date)}/" style="flex-direction:row;justify-content:space-between;align-items:center">
  <h3>${esc(longDate(d.date))}</h3>
  <span class="k">${d.stories.length} stories &middot; ${d.stories.filter((s) => s.analysis).length} deep</span>
</a>`,
    )
    .join("\n");
  const body = `<main class="narrow prose" style="padding-top:56px">
  <h1>Archive</h1>
  <p>${digests.length} ${digests.length === 1 ? "day" : "days"}, ${flat(digests).length} stories.</p>
  <div style="display:grid;gap:10px;margin-top:24px">${rows || '<p class="empty">Nothing yet.</p>'}</div>
</main>`;
  return shell({ title: "Archive", description: "Every daily AI digest.", path: "/archive/", body });
}

/** One whole day. What the archive links to, and where older days live. */
export function dayPage(d: Digest): string {
  const body = `<main class="wrap">
  <section class="hero" style="padding-bottom:16px">
    <p class="eyebrow">// daily digest</p>
    <h1 style="font-size:clamp(30px,5vw,50px);max-width:none">${esc(longDate(d.date))}</h1>
    <p class="lede">${d.stories.length} stories, ${d.stories.filter((s) => s.analysis).length} with a full analysis.</p>
  </section>
  <div class="grid">${d.stories.map(card).join("\n")}</div>
</main>`;
  return shell({
    title: longDate(d.date),
    description: `${d.stories.length} AI stories from ${longDate(d.date)}.`,
    path: `/day/${d.date}/`,
    body,
  });
}

/** How the site works. Trust page: says what the model does and does not do. */
export function aboutPage(): string {
  const body = `<main class="narrow prose" style="padding-top:56px">
  <h1>How this works</h1>
  <p>A news site written by a model has one job before any other: not making things up. This page is the
  list of choices made to keep that true.</p>
  <h2>Where stories come from</h2>
  <p>arXiv, Hacker News, GitHub and the public feeds of the major labs. Nothing is scraped from behind a
  paywall and nothing is rewritten from another newsletter.</p>
  <h2>What ranks a story</h2>
  <p><strong>Not the model.</strong> Order comes from numbers the sources already measured &mdash; Hacker News
  points and GitHub stars &mdash; decayed by age. A model asked to score importance would be guessing at
  something that has already been counted.</p>
  <h2>What the model does</h2>
  <p>It compresses. A small model writes the one-line summary of every story; a larger one writes the long read
  for the few that earn it. Both are shown only the title and abstract, and are told they have not read the
  linked page and must not add a number, name or date that is not in front of them.</p>
  <h2>What every analysis ends with</h2>
  <p>A section called <em>what this doesn't show</em>. An analysis that only amplifies is how a news site starts
  inventing significance, so the caveats field is mandatory.</p>
  <h2>Never twice</h2>
  <p>Every story is checked against everything already published, by id, address and title, before a model sees it.</p>
  <h2>The archive</h2>
  <pre>data/2026-09-20.json   one file per day, committed to git</pre>
  <p>No database. If a run goes wrong it is reverted like any other commit.</p>
</main>`;
  return shell({ title: "How it works", description: "How newsai chooses, ranks and writes its stories.", path: "/about/", body });
}

export function notFoundPage(): string {
  const body = `<main class="narrow"><p class="empty" style="padding:120px 0">404 &mdash; nothing here. <a href="/" style="text-decoration:underline">back to today</a></p></main>`;
  return shell({ title: "Not found", description: "Page not found.", path: "/404.html", body });
}

/** RSS 2.0 of the newest stories, so the site is subscribable. */
export function rss(digests: readonly Digest[]): string {
  const items = flat(digests)
    .slice(0, 40)
    .map((s) => {
      const link = s.analysis && s.slug ? `${SITE_URL}/story/${s.slug}/` : safeUrl(s.url);
      return `    <item>
      <title>${esc(s.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(s.id)}</guid>
      <pubDate>${new Date(s.publishedAt).toUTCString()}</pubDate>
      <description>${esc(s.summary)}</description>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${SITE_NAME}</title>
  <link>${SITE_URL}/</link>
  <description>${esc(TAGLINE)}</description>
${items}
</channel></rss>
`;
}

export function sitemap(digests: readonly Digest[]): string {
  const urls = [
    "/", "/archive/", "/about/",
    ...ALL_TAGS.map((t) => `/tag/${t}/`),
    ...digests.map((d) => `/day/${d.date}/`),
    ...flat(digests).filter((s) => s.analysis && s.slug).map((s) => `/story/${s.slug}/`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join("\n")}
</urlset>
`;
}
