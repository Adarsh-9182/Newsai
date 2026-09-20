/**
 * The pages. Each is a pure function from the archive to a string, which is
 * what makes the whole site testable without a browser and rebuildable from
 * `data/` alone.
 */

import { Digest, Story } from "../types.js";
import { shell, card, esc, longDate, shortDate, tagPill, safeUrl, saveButton, SITE_URL, SITE_NAME, TAGLINE } from "./layout.js";

import { TAGS } from "../tags.js";

export const ALL_TAGS = TAGS;

const flat = (ds: readonly Digest[]): Story[] => ds.flatMap((d) => [...d.stories]);

function chips(active?: string): string {
  const one = (href: string, label: string, on: boolean) =>
    `<a class="chip${on ? " on" : ""}" href="${href}">${label}</a>`;
  return `<div class="chips">${one("/", "all", !active)}${ALL_TAGS.map((t) => one(`/tag/${t}/`, t, t === active)).join("")}</div>`;
}

function lead(s: Story): string {
  const deep = s.analysis && s.slug;
  const href = deep ? `/story/${s.slug}/` : safeUrl(s.url);
  return `<div class="lead spot" data-tags="${esc(s.tags.join(" "))}">
  ${saveButton(s)}
  <a href="${esc(href)}"${deep ? "" : ' rel="noopener noreferrer" target="_blank"'} style="display:block">
  <div class="kicker"><span class="k">${esc(s.source)}</span>${deep ? '<span class="tag deep">analysis</span>' : ""}${s.tags
    .slice(0, 2)
    .map((t) => `<span class="tag ${esc(t)}">${esc(t)}</span>`)
    .join("")}</div>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.summary)}</p>
  <span class="go">${deep ? "read the analysis" : "open source"}</span>
  </a>
</div>`;
}

const SOURCES = ["arXiv", "Hacker News", "GitHub", "OpenAI", "Google DeepMind", "Google AI", "Hugging Face", "Microsoft Research", "Together AI", "Simon Willison"];

/**
 * Today's stories as bars, where bar length is the source's own count (HN
 * points, GitHub stars). It is the ranking made visible: nothing on it is
 * generated, and stories without a count (arXiv) are simply not on it.
 */
function signalBoard(stories: readonly Story[]): string {
  const ranked = stories.filter((s) => s.signal > 0).sort((a, b) => b.signal - a.signal).slice(0, 5);
  const max = ranked[0]?.signal ?? 1;
  const rows = ranked
    .map((s, i) => {
      const href = s.analysis && s.slug ? `/story/${s.slug}/` : safeUrl(s.url);
      const unit = s.source === "GitHub" ? "★" : "pts";
      return `<li style="--i:${i};--w:${Math.max(4, Math.round((s.signal / max) * 100))}%"><a href="${esc(href)}">
    <span class="n">0${i + 1}</span>
    <span class="t"><span>${esc(s.title)}</span><span class="bar-track"><span class="bar-fill"></span></span></span>
    <span class="v">${s.signal.toLocaleString("en-IN")} ${unit}</span></a></li>`;
    })
    .join("");
  return `<aside class="board rise" aria-label="Today's signal">
  <header><i></i><i></i><i></i><b>signal · today</b></header>
  ${rows ? `<ol>${rows}</ol>` : '<p class="empty" style="padding:40px 0">No ranked stories yet.</p>'}
  <footer>bar = HN points or GitHub stars &mdash; measured, not generated</footer>
</aside>`;
}

/** The front page: hero, signal board, the lead, today's grid, recent days, how it works. */
export function home(digests: readonly Digest[]): string {
  const today = digests[0];
  const stories = today?.stories ?? [];
  const [first, ...rest] = stories;
  const deepCount = stories.filter((s) => s.analysis).length;

  const older = digests
    .slice(1)
    .map(
      (d) => `<div class="dayhead"><h2><a href="/day/${esc(d.date)}/">${esc(longDate(d.date))}</a></h2><span>${d.stories.length} stories</span></div>
<div class="grid">${d.stories.map(card).join("\n")}</div>`,
    )
    .join("\n");

  const marquee = [...SOURCES, ...SOURCES].map((n) => `<span>${esc(n)}</span>`).join("");

  const body = `<main class="wrap">
  <section class="hero">
    <div>
      <p class="eyebrow rise">${today ? esc(shortDate(today.date)) : "soon"} &middot; ${stories.length} stories &middot; ${deepCount} deep reads</p>
      <h1 class="rise">Everything in AI, <em>actually analysed.</em></h1>
      <p class="lede rise">Papers, releases and agent tooling from arXiv, Hacker News, GitHub and the labs &mdash;
      ranked by what people really read, each with an honest note on what it doesn't prove.</p>
      <form class="inline-form rise" data-subscribe novalidate>
        <input class="input" type="email" name="email" placeholder="you@company.com" autocomplete="email" aria-label="Email address" required>
        <button class="btn primary" type="submit">Get the daily digest</button>
      </form>
      <p class="fineprint" data-subscribe-msg>Free. 07:00 IST. One email a day, unsubscribe in one click.</p>
    </div>
    ${signalBoard(stories)}
  </section>
  <div class="marquee" aria-hidden="true"><div>${marquee}</div></div>
  <div class="bar"><h2>${today ? esc(longDate(today.date)) : "Today"}</h2><div class="chips" id="filter-chips">${chips()}</div></div>
  ${first ? lead(first) : '<p class="empty">No digest yet &mdash; the first run publishes at 07:00 IST.</p>'}
  ${rest.length ? `<div class="grid">${rest.map(card).join("\n")}</div>` : ""}
  ${older}

  <section class="bento" aria-label="How newsai works">
    <div class="tile spot wide"><span class="num">01 / RANKING</span><h3>Ordered by measurement, not by a model's opinion.</h3>
      <p>Hacker News points and GitHub stars are decayed by age. A model asked to score importance would be guessing at something that has already been counted.</p>
<pre><i>$</i> rank --by <b>signal</b> --decay <b>48h</b>
<i>#</i> the model never sees the ranking</pre></div>
    <div class="tile spot"><span class="num">02 / HONESTY</span><h3>Every analysis ends with what it doesn't show.</h3>
      <p>The caveats field is mandatory. An analysis that only amplifies is how a news site starts inventing significance.</p></div>
    <div class="tile spot"><span class="num">03 / NEVER TWICE</span><h3>Checked against everything already published.</h3>
      <p>By id, address and title, before a model sees it. Nothing is paid for that a reader wouldn't see.</p></div>
    <div class="tile spot wide"><span class="num">04 / COST</span><h3>Small model for the line, larger model for the long read.</h3>
      <p>Compressing an abstract is mechanical; saying what a release changes for someone building with it is judgement. Depth is rationed to the few stories that earn it.</p>
<pre><i>summarise</i>  claude-haiku-4-5   <b>every story</b>
<i>analyse  </i>  claude-sonnet-5    <b>top ${Number(process.env.NEWSAI_ANALYSIS_DEPTH ?? 5)} a day</b></pre></div>
  </section>

  <section class="band">
    <h2>The day in AI, before your standup.</h2>
    <p>The stories that matter, the honest read on each, and nothing you've already seen. Every morning at 07:00 IST.</p>
    <form class="inline-form" data-subscribe novalidate>
      <input class="input" type="email" name="email" placeholder="you@company.com" autocomplete="email" aria-label="Email address" required>
      <button class="btn primary" type="submit">Subscribe</button>
    </form>
    <p class="fineprint" data-subscribe-msg>Or <a href="/signup/" style="text-decoration:underline">create an account</a> to save stories and follow topics.</p>
  </section>
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

  const body = `<div class="progress" aria-hidden="true"></div>
<main class="narrow"><article class="story">
  <a class="crumb" href="/">&larr; today</a>
  <div class="foot" style="display:flex;gap:8px;flex-wrap:wrap">${s.tags.map(tagPill).join("")}</div>
  <h1>${esc(s.title)}</h1>
  <div class="meta"><span>${esc(s.source)}</span><span>${esc(longDate(date))}</span>${
    s.signal > 0 ? `<span>${s.signal.toLocaleString("en-IN")} ${s.source === "GitHub" ? "stars" : "points"}</span>` : ""
  }</div>
  <div class="actions">
    <span class="spot" style="border-radius:9px">${saveButton(s)}</span>
    <button class="btn sm" type="button" data-copy-link>Copy link</button>
    <a class="btn sm" href="${esc(safeUrl(s.url))}" rel="noopener noreferrer" target="_blank">Read the original &nearr;</a>
  </div>
  <p class="tldr">${esc(s.summary)}</p>
  <section class="sec what"><h2>What happened</h2><p>${esc(a.what)}</p></section>
  <section class="sec sowhat"><h2>Why it matters</h2><p>${esc(a.soWhat)}</p></section>
  <section class="sec caveats"><h2>What this doesn't show</h2><p>${esc(a.caveats)}</p></section>
  ${
    a.takeaways.length
      ? `<section class="sec take"><h2>Takeaways</h2><ul>${a.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`
      : ""
  }
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
  <section class="hero" style="grid-template-columns:1fr;padding-bottom:0">
    <div>
      <p class="eyebrow">tag</p>
      <h1 style="font-size:clamp(38px,6vw,64px)"><em>#${esc(tag)}</em></h1>
      <p class="lede">${items.length} ${items.length === 1 ? "story" : "stories"} across the archive.</p>
      <button class="btn" type="button" data-follow="${esc(tag)}" aria-pressed="false">+ Follow ${esc(tag)}</button>
    </div>
  </section>
  <div class="bar"><h2>filter</h2><div class="chips">${chips(tag)}</div></div>
  ${items.length ? `<div class="grid">${items.map(card).join("\n")}</div>` : '<p class="empty">Nothing tagged this yet.</p>'}
</main>`;
  return shell({ title: `#${tag}`, description: `AI stories tagged ${tag}.`, path: `/tag/${tag}/`, body });
}

/** Every day ever published — the page that makes the archive browsable. */
export function archivePage(digests: readonly Digest[]): string {
  const rows = digests
    .map(
      (d) => `<a class="rowlink spot" href="/day/${esc(d.date)}/">
  <h3>${esc(longDate(d.date))}</h3>
  <span class="k">${d.stories.length} stories &middot; ${d.stories.filter((s) => s.analysis).length} deep</span>
</a>`,
    )
    .join("\n");
  const body = `<main class="narrow prose" style="padding-top:56px">
  <h1>Archive</h1>
  <p>${digests.length} ${digests.length === 1 ? "day" : "days"}, ${flat(digests).length} stories.</p>
  <div class="list" style="margin-top:24px">${rows || '<p class="empty">Nothing yet.</p>'}</div>
</main>`;
  return shell({ title: "Archive", description: "Every daily AI digest.", path: "/archive/", body });
}

/** One whole day. What the archive links to, and where older days live. */
export function dayPage(d: Digest): string {
  const body = `<main class="wrap">
  <section class="hero" style="grid-template-columns:1fr;padding-bottom:10px">
    <div>
      <p class="eyebrow">daily digest</p>
      <h1 style="font-size:clamp(32px,5vw,54px)">${esc(longDate(d.date))}</h1>
      <p class="lede">${d.stories.length} stories, ${d.stories.filter((s) => s.analysis).length} with a full analysis.</p>
    </div>
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

/** One entry in the client-side search index. Short keys: this file is downloaded by every visitor. */
export interface SearchEntry {
  readonly t: string;
  readonly s: string;
  readonly u: string;
  readonly g: readonly string[];
  readonly d: string;
  readonly k: string;
  readonly a: 0 | 1;
}

export function searchIndex(digests: readonly Digest[]): SearchEntry[] {
  return digests.flatMap((d) =>
    d.stories.map((s) => ({
      t: s.title,
      s: s.summary.slice(0, 160),
      u: s.analysis && s.slug ? `/story/${s.slug}/` : safeUrl(s.url),
      g: s.tags,
      d: d.date,
      k: s.source,
      a: (s.analysis ? 1 : 0) as 0 | 1,
    })),
  );
}

const PERKS = `<ul class="perks">
  <li><span class="ic">★</span><div><b>Save stories</b>Keep the ones worth coming back to, on every device.</div></li>
  <li><span class="ic">#</span><div><b>Follow topics</b>Agents, research, infra &mdash; your front page leads with what you follow.</div></li>
  <li><span class="ic">@</span><div><b>The daily digest</b>The day's deep reads in your inbox at 07:00 IST. Off by default, one click to stop.</div></li>
</ul>`;

function passwordField(autocomplete: string): string {
  return `<div class="field"><label for="password">Password</label>
      <div class="pw"><input class="input" id="password" name="password" type="password" autocomplete="${autocomplete}" minlength="8" required placeholder="At least 8 characters">
      <button type="button" data-toggle-pw>show</button></div></div>`;
}

export function loginPage(): string {
  const body = `<main class="auth">
  <div class="auth-side"><h1>Welcome <em>back.</em></h1><p>Your saved stories and followed topics are waiting.</p>${PERKS}</div>
  <div class="authcard rise">
    <h2>Sign in</h2><p class="sub">Use the email you signed up with.</p>
    <form data-auth="login" novalidate>
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required placeholder="you@company.com"></div>
      ${passwordField("current-password")}
      <p class="msg" role="alert" data-msg></p>
      <button class="btn primary block" type="submit">Sign in</button>
    </form>
    <p class="alt">New here? <a href="/signup/" data-keep-next>Create an account</a></p>
  </div>
</main>`;
  return shell({ title: "Sign in", description: "Sign in to newsai.", path: "/login/", body, noindex: true });
}

export function signupPage(): string {
  const body = `<main class="auth">
  <div class="auth-side"><h1>Read AI news <em>your way.</em></h1><p>Free. No card. Takes ten seconds.</p>${PERKS}</div>
  <div class="authcard rise">
    <h2>Create your account</h2><p class="sub">Your email is only used to sign you in and, if you opt in, send the digest.</p>
    <form data-auth="signup" novalidate>
      <div class="field"><label for="name">Name <span style="text-transform:none;letter-spacing:0;color:var(--dim-2)">(optional)</span></label><input class="input" id="name" name="name" type="text" autocomplete="name" maxlength="80" placeholder="Ada Lovelace"></div>
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required placeholder="you@company.com"></div>
      ${passwordField("new-password")}
      <p class="msg" role="alert" data-msg></p>
      <button class="btn primary block" type="submit">Create account</button>
    </form>
    <p class="alt">Already have one? <a href="/login/" data-keep-next>Sign in</a></p>
  </div>
</main>`;
  return shell({ title: "Create account", description: "Create a free newsai account.", path: "/signup/", body, noindex: true });
}

/**
 * The account page is a shell: it holds no user data at build time. The
 * script fetches /api/me and /api/saves and fills it in, and sends a visitor
 * without a session to the sign-in page.
 */
export function accountPage(): string {
  const body = `<main class="narrow acct" id="account" hidden>
  <div class="acct-head">
    <span class="avatar" id="acct-avatar"></span>
    <div><h1 id="acct-name">Your account</h1><p id="acct-email"></p></div>
    <button class="btn sm" type="button" data-logout>Sign out</button>
  </div>
  <section class="panel">
    <h2>Your feed <span class="saved-flag" id="prefs-flag">saved ✓</span></h2>
    <p>Follow topics and the front page leads with them.</p>
    <div class="toggles" id="follow-toggles">${ALL_TAGS.map((t) => `<button class="toggle" type="button" data-tag="${t}" aria-pressed="false">${t}</button>`).join("")}</div>
    <div class="switch"><div><b>Daily digest by email</b><span>The deep reads at 07:00 IST. Off until you turn it on.</span></div>
      <button class="sw" id="digest-switch" type="button" role="switch" aria-checked="false" aria-label="Daily digest by email"></button></div>
  </section>
  <section class="panel">
    <h2>Saved stories <span class="k" id="saved-count"></span></h2>
    <p>Everything you've bookmarked, newest first.</p>
    <div id="saved-list"><div class="skel"></div><div class="skel"></div></div>
  </section>
</main>
<main class="narrow" id="account-gate"><p class="empty" style="padding:120px 0">Checking your session&hellip;</p></main>`;
  return shell({ title: "Account", description: "Your saved stories and preferences.", path: "/account/", body, noindex: true });
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
