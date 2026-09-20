# newsai.co.in

AI news for Indian builders — agents first.

A daily digest assembled from arXiv, Hacker News, GitHub and lab blogs,
summarised by a small model, published as static HTML. No database, no server,
no framework.

## How it works

```
arXiv · Hacker News · GitHub · lab blogs (RSS/Atom)
        │
        ├─ dedupe within the run, and against everything already published
        ├─ rank by the source's own signal (HN points, stars) decayed by age
        ├─ cap at NEWSAI_MAX_STORIES before spending anything
        ├─ summarise in batches (Claude Haiku 4.5)
        │
        └─ data/YYYY-MM-DD.json  ──git commit──▶  Vercel deploy ──▶ public/index.html
```

GitHub Actions runs it at 01:30 UTC (07:00 IST) and commits the result. The
commit is the deploy. Nothing is running between runs.

**The archive is the database.** One committed JSON file per day: a few KB,
version-controlled, and a bad run is reverted with `git revert` rather than
repaired with SQL.

**The model never ranks and never researches.** It is shown a title and an
abstract and asked to compress them. What leads the page is decided by HN
points and GitHub stars — measurements that already exist. The model is told
it has not read the linked page and must not add a fact that is not in front
of it.

## Cost

The only thing that costs money is the summariser, and two things keep it flat:
items are batched (25 stories ≈ 4 requests, not 25), and `NEWSAI_MAX_STORIES`
caps the run *before* it starts, so a dramatic news day costs the same as a
quiet one. Everything else — Actions, Vercel, all four sources — is free.

Switch `NEWSAI_MODEL` to `claude-sonnet-5` if the summaries ever read badly.

## Running it

```bash
npm install
cp .env.example .env        # add ANTHROPIC_API_KEY
npm run daily               # digest + render
open public/index.html
```

| Script | Does |
|---|---|
| `npm run digest` | Fetch, dedupe, summarise, write `data/<today>.json` |
| `npm run render` | Rebuild `public/index.html` from the archive |
| `npm run daily`  | Both |
| `npm run typecheck` | `tsc --noEmit` |

## Deploying

1. Push this repo to GitHub.
2. Add `ANTHROPIC_API_KEY` under **Settings → Secrets and variables → Actions**.
3. Import the repo on Vercel. Build settings come from `vercel.json`.
4. Point `newsai.co.in` at Vercel and add it under the project's Domains.
5. Run the workflow once by hand (**Actions → daily digest → Run workflow**)
   to check it end to end before trusting the schedule.

## Adding a source

Anything publishing RSS or Atom is one line in `FEEDS` (`src/sources/blogs.ts`).
Anything else is a file in `src/sources/` exporting `(): Promise<RawItem[]>`,
added to the list in `src/sources/index.ts`. Sources are awaited independently —
a broken one is logged and skipped, never fatal.

Anthropic and Meta AI are deliberately absent: neither publishes a public feed
at the usual paths. Their releases arrive via Hacker News instead.

## Honesty

Summaries are model-written from each item's own title and abstract, and can be
wrong. The footer says so on every page. Follow the link before relying on
anything.
