# newsai.co.in

AI news, analysed — agents first.

A daily digest assembled from arXiv, Hacker News, GitHub and lab blogs. A small
model summarises every story; a larger one writes a long read, with a mandatory
"what this doesn't show" section, for the few that earn it. Published as static
HTML: no database, no server, no client-side JavaScript.

## How it works

```
arXiv · Hacker News · GitHub · lab blogs (RSS/Atom)
        │
        ├─ dedupe within the run, and against everything already published
        ├─ rank by the source's own signal (HN points, stars) decayed by age
        ├─ cap at NEWSAI_MAX_STORIES before spending anything
        ├─ summarise in batches (Claude Haiku 4.5)
        ├─ analyse the top NEWSAI_ANALYSIS_DEPTH stories (Claude Sonnet 5)
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

## The site

Every page is a static file, generated from `data/` alone. Delete `public/`, run
`npm run render`, get the same site.

| Route | What |
|---|---|
| `/` | Hero, today's lead, grid, recent days |
| `/story/<slug>/` | The long read: what happened · why it matters · **what this doesn't show** · takeaways |
| `/tag/<tag>/` | Every story under a tag. The filter chips are real links, not JavaScript |
| `/day/<date>/` · `/archive/` | Any past day |
| `/about/` | How stories are chosen and what the model may and may not do |
| `/feed.xml` · `/sitemap.xml` | RSS and sitemap |

Design tokens (off-black `#1e1e1e`, off-white `#fefefe`, Host Grotesk +
JetBrains Mono, green/teal/pink accents) were read from typesafe.ai's CSS. Colour
carries meaning: green is research, teal is agents, pink is policy.

**Link safety.** Story URLs come from feeds this project does not control, so
only `http(s)` links are ever emitted (`safeUrl`). Every dynamic value is
escaped. Both were tested with hostile input, not assumed.

## Preview without an API key

```bash
npm run preview     # http://localhost:3000, fictional sample data only
```

## Cost

The models are the only thing that costs money. Depth is rationed, which is what
keeps it cheap: Haiku summarises everything (25 stories ≈ 4 batched requests),
and Sonnet writes a long read for only `NEWSAI_ANALYSIS_DEPTH` (default 5).
Both ceilings apply *before* anything is sent, so a dramatic news day costs the
same as a quiet one. Actions, Vercel and all the sources are free.

**These figures are unmeasured.** The summariser and analyser have not yet run
against the live API; the first real run prints token counts, and that is the
number to trust.

`NEWSAI_MODEL` (summaries) and `NEWSAI_ANALYSIS_MODEL` (long reads) override the defaults.

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
| `npm run preview` | Render fictional sample data and serve it, with a working `/api` on an in-memory database, on :3000 |
| `npm run send` | Email the day's digest to confirmed subscribers (safe to re-run) |
| `npm test` | API tests, run against the in-memory store **and** real Postgres SQL (PGlite) |
| `npm run typecheck` | `tsc --noEmit` |

## Deploying

1. Push this repo to GitHub.
2. Import the repo on Vercel. Build settings come from `vercel.json`; the API
   is the single function in `api/`, on the Node runtime (the Postgres driver
   needs a TCP socket, which the edge runtime cannot open).
3. Create the database (Neon or Supabase) and set these under **Vercel →
   Settings → Environment Variables**:
   `DATABASE_URL`, `NEWSAI_MAIL_SECRET`, `RESEND_API_KEY`, `NEWSAI_SITE_URL`.
   Tables are created on the first request.
4. Set the Actions secrets under **GitHub → Settings → Secrets and variables →
   Actions**: `ANTHROPIC_API_KEY`, and — to send mail — `DATABASE_URL`,
   `RESEND_API_KEY` and `NEWSAI_MAIL_SECRET`. **`NEWSAI_MAIL_SECRET` must be
   the same string in both places**, or links made by one are rejected by the
   other. The send step skips itself when they are missing.
5. Point `newsai.co.in` at Vercel and add it under the project's Domains.
6. Check `/api/health` — `{"ok":true,"database":true}` means the function
   deployed and reached the database.
7. Run the workflow once by hand (**Actions → daily digest → Run workflow**)
   to check it end to end before trusting the schedule.

## Accounts and the database

The site is static; accounts are a thin API (`api/index.ts` → `src/server/app.ts`)
that runs as one Vercel function. It handles sign-up / sign-in, saved stories,
followed topics and the email list. Everything it stores goes through the
`Store` interface (`src/server/types.ts`), so the database is a late decision:

- **No `DATABASE_URL`, running locally** — in-memory, so `npm run preview` just works.
- **No `DATABASE_URL`, on Vercel** — the API answers `503 no_database`. It never
  falls back to memory in production, which would lose every account on a cold start.
- **`DATABASE_URL` set** — Postgres. Neon and Supabase are both plain Postgres and
  run the same code; the tables are created on first connect (`src/server/store/schema.ts`,
  safe to re-run, with row-level security on so Supabase's public API key sees nothing).

To connect: create the project, copy the connection string into `DATABASE_URL`
(Vercel → Settings → Environment Variables), redeploy. Nothing else changes.

Security choices worth knowing: passwords are scrypt-hashed; the session cookie
is HttpOnly + SameSite=Lax (+ Secure on https) and the database stores only its
SHA-256; writes must be same-origin JSON (no CSRF token to get wrong); login and
sign-up are rate limited in the database; and `vercel.json` sets a strict
Content-Security-Policy (`script-src 'self'`).

## Email

Subscribing is **double opt-in**: an address is stored the moment someone asks,
but the digest is only ever sent after the owner clicks a confirmation link, so
nobody can sign up somebody else's inbox. Both links in an email — confirm and
unsubscribe — are HMAC-signed with `NEWSAI_MAIL_SECRET` and carry their own
purpose, so one cannot be edited into the other, and nothing is looked up to
check them (the click arrives days later with no session). Confirmation links
expire after seven days; unsubscribe links never do, because an old newsletter
must still work. Every digest carries `List-Unsubscribe` headers for one-click
unsubscribe in Gmail and Outlook.

A confirmation is sent **once per subscription**, never once a day: an address
that is added and never confirmed is mailed a single time and then left alone,
because it has consented to nothing. Unsubscribing and subscribing again counts
as a new subscription and earns a fresh link.

`npm run send` mails the day's digest to confirmed addresses, and is **safe to
re-run**: each address is claimed in the database before it is mailed, so a
crash halfway through a list does not mail the first half twice. Without
`RESEND_API_KEY` it prints each email instead of sending it — that is the way
to try the whole flow without mailing anyone. It refuses to run without
`NEWSAI_MAIL_SECRET`, without `DATABASE_URL`, or with no digest for the day.

The provider is [Resend](https://resend.com), reached with one `fetch` and no
SDK; swapping it means writing another `Mailer` in `src/server/mailer.ts`.

**Not done yet:** the sending domain has to be verified with the provider
(SPF/DKIM) before real mail is deliverable, and `NEWSAI_MAIL_SECRET` must be
set to the same value on both Vercel and GitHub Actions.

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
