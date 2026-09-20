/**
 * The site: static HTML, generated from the archive.
 *
 * Every page is written to `public/<path>/index.html`, so Vercel serves them
 * as plain files with no rewrite rules and no runtime. The whole site is a
 * pure function of `data/`: delete `public/`, run this, get the same site.
 * That is what makes a bad day a `git revert` instead of a repair job.
 *
 * Reading needs no JavaScript: filters are links to real pages, which makes
 * every tag, day and story an indexable, shareable URL — the property a news
 * site's traffic actually depends on. app.js only adds accounts, search and polish.
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Digest } from "./types.js";
import { readArchive } from "./archive.js";
import { home, storyPage, tagPage, archivePage, dayPage, aboutPage, notFoundPage, loginPage, signupPage, accountPage, searchIndex, rss, sitemap, ALL_TAGS } from "./ui/pages.js";
import { APP_JS, THEME_JS } from "./ui/client.js";
import { SITE_URL } from "./ui/layout.js";

const PUBLIC_DIR = new URL("../public/", import.meta.url).pathname;

/** How many days the front page carries. Older days live on their own pages. */
const DAYS_ON_HOME = 5;

async function put(path: string, content: string): Promise<void> {
  const full = join(PUBLIC_DIR, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

export async function render(): Promise<number> {
  // Rebuilt from scratch every time: a story that was removed from the archive
  // must not linger as an orphaned page.
  await rm(PUBLIC_DIR, { recursive: true, force: true });

  const all: Digest[] = await readArchive();
  let pages = 0;
  const write = async (path: string, html: string) => {
    await put(path, html);
    pages += 1;
  };

  await write("index.html", home(all.slice(0, DAYS_ON_HOME)));
  await write("archive/index.html", archivePage(all));
  await write("about/index.html", aboutPage());
  await write("404.html", notFoundPage());
  // Account pages are shells; the script fills them in for whoever is signed in.
  await write("login/index.html", loginPage());
  await write("signup/index.html", signupPage());
  await write("account/index.html", accountPage());
  await write("app.js", APP_JS);
  await write("theme.js", THEME_JS);
  await write("search.json", JSON.stringify(searchIndex(all)));
  await write("feed.xml", rss(all));
  await write("sitemap.xml", sitemap(all));
  await write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  for (const tag of ALL_TAGS) await write(`tag/${tag}/index.html`, tagPage(tag, all));

  for (const d of all) {
    await write(`day/${d.date}/index.html`, dayPage(d));
    for (const s of d.stories) {
      if (s.analysis && s.slug) await write(`story/${s.slug}/index.html`, storyPage(s, d.date));
    }
  }

  console.log(`Rendered ${pages} pages from ${all.length} day(s) → public/`);
  return pages;
}

if (process.argv[1]?.endsWith("render.js")) {
  render().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
