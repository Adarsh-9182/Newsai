/**
 * The API, as one function: Request in, Response out.
 *
 * Nothing here knows about Node's http module, Vercel or any database. That is
 * what lets the same `handle` run behind the local dev server, inside a Vercel
 * function, and directly in a test with no network at all.
 *
 * Security posture, in the order a request meets it:
 *   1. Every state-changing request must be same-origin and JSON. A cross-site
 *      form cannot send `application/json`, and a cross-site script is stopped
 *      by the Origin check, so there is no CSRF token to get wrong.
 *   2. Auth endpoints are rate limited per IP and per account.
 *   3. Bodies are size-capped and every field is validated before it reaches
 *      the store. The store only ever sees bound parameters.
 *   4. The session cookie is HttpOnly + SameSite=Lax (+ Secure over https) and
 *      holds a random token; the database holds only its SHA-256.
 */

import { Store, User } from "./types.js";
import { TAGS } from "../tags.js";
import { hashPassword, verifyPassword, DUMMY_HASH, newToken, hashToken } from "./crypto.js";
import { mailSecret, readToken } from "./maillink.js";

const COOKIE = "nai_session";
const SESSION_DAYS = 30;
const MAX_BODY = 8 * 1024;

// — small helpers —

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}
const bad = (message: string, code = "invalid") => new HttpError(400, code, message);

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/**
 * A minimal HTML reply, for the links people click in an email. It carries no
 * dynamic text: everything on it is written here, so there is nothing from a
 * token or a query string to escape.
 */
function page(status: number, title: string, detail: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title} — newsai</title><meta name="robots" content="noindex"></head>` +
      `<body style="margin:0;background:#141414;color:#fefefe;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">` +
      `<main style="max-width:520px;margin:0 auto;padding:18vh 22px 0;text-align:center">` +
      `<h1 style="font-size:28px;letter-spacing:-.03em;margin:0 0 12px">${title}</h1>` +
      `<p style="color:#d2d2d2;margin:0 0 26px">${detail}</p>` +
      `<a href="/" style="display:inline-block;padding:11px 20px;border:1px solid #3c3c3c;border-radius:9px;color:#fefefe;text-decoration:none">Back to newsai</a>` +
      `</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

const isHttps = (req: Request): boolean =>
  new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

function sessionCookie(req: Request, token: string, maxAgeSec: number): string {
  return [
    `${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`,
    ...(isHttps(req) ? ["Secure"] : []),
  ].join("; ");
}

const clientIp = (req: Request): string =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";

/** Same-origin check. `Origin` is sent on every cross-site POST by every modern browser. */
function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === host; } catch { /* malformed origin → rejected below */ }
    if (!ok) throw new HttpError(403, "forbidden", "Cross-origin request refused.");
  } else if (req.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "forbidden", "Cross-origin request refused.");
  }
}

async function body(req: Request): Promise<Record<string, unknown>> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "unsupported", "Send application/json.");
  }
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "too_large", "Request too large.");
  try {
    const v: unknown = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* falls through */ }
  throw bad("Body must be a JSON object.");
}

// — validation —

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

function str(v: unknown, field: string, max: number): string {
  if (typeof v !== "string") throw bad(`${field} is required.`);
  const s = v.trim();
  if (!s || s.length > max) throw bad(`${field} must be 1–${max} characters.`);
  return s;
}

function email(v: unknown): string {
  const e = str(v, "email", 254).toLowerCase();
  if (!EMAIL.test(e)) throw bad("Enter a valid email address.");
  return e;
}

function password(v: unknown): string {
  if (typeof v !== "string" || v.length < 8) throw bad("Password must be at least 8 characters.");
  if (v.length > 200) throw bad("Password is too long.");
  return v;
}

function httpUrl(v: unknown): string {
  const raw = str(v, "url", 2000);
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch { /* falls through */ }
  throw bad("url must be an http(s) link.");
}

// — the app —

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, follows: u.follows, digest: u.digest });

async function currentUser(req: Request, store: Store): Promise<User | null> {
  const token = cookies(req)[COOKIE];
  return token ? store.sessionUser(hashToken(token)) : null;
}

async function startSession(req: Request, store: Store, user: User): Promise<Response> {
  const token = newToken();
  await store.createSession(user.id, hashToken(token), new Date(Date.now() + SESSION_DAYS * 86_400_000));
  return json(200, { user: publicUser(user) }, { "set-cookie": sessionCookie(req, token, SESSION_DAYS * 86_400) });
}

export async function handle(req: Request, store: Store | null): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method.toUpperCase();

  try {
    if (!path.startsWith("/api/")) throw new HttpError(404, "not_found", "Not found.");
    if (path === "/api/health") return json(200, { ok: true, database: store !== null });
    if (!store) {
      throw new HttpError(503, "no_database", "Accounts are not switched on yet: DATABASE_URL is not set.");
    }
    if (method !== "GET" && method !== "HEAD") assertSameOrigin(req);
    const ip = clientIp(req);

    // — who am I —
    if (path === "/api/me" && method === "GET") {
      const u = await currentUser(req, store);
      return json(200, { user: u ? publicUser(u) : null });
    }

    // — sign up / in / out —
    if (path === "/api/auth/signup" && method === "POST") {
      if (!(await store.hit(`signup:${ip}`, 10, 3600))) throw new HttpError(429, "rate_limited", "Too many sign-ups. Try again later.");
      const b = await body(req);
      const e = email(b.email);
      const pw = password(b.password);
      const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
      const user = await store.createUser({ email: e, name, passwordHash: await hashPassword(pw) });
      if (!user) throw new HttpError(409, "email_taken", "An account with this email already exists. Try signing in.");
      return startSession(req, store, user);
    }

    if (path === "/api/auth/login" && method === "POST") {
      const b = await body(req);
      const e = email(b.email);
      const pw = typeof b.password === "string" ? b.password.slice(0, 200) : "";
      if (!(await store.hit(`login-ip:${ip}`, 30, 900)) || !(await store.hit(`login:${e}`, 8, 900))) {
        throw new HttpError(429, "rate_limited", "Too many attempts. Wait a few minutes and try again.");
      }
      const found = await store.userByEmail(e);
      // Always run one scrypt, found or not, so timing does not reveal which emails exist.
      const ok = await verifyPassword(pw, found?.passwordHash ?? DUMMY_HASH);
      if (!found || !ok) throw new HttpError(401, "bad_credentials", "Email or password is incorrect.");
      const { passwordHash: _omit, ...user } = found;
      return startSession(req, store, user);
    }

    if (path === "/api/auth/logout" && method === "POST") {
      const token = cookies(req)[COOKIE];
      if (token) await store.deleteSession(hashToken(token));
      return json(200, { ok: true }, { "set-cookie": sessionCookie(req, "", 0) });
    }

    // — newsletter, no account needed —
    if (path === "/api/subscribe" && method === "POST") {
      if (!(await store.hit(`sub:${ip}`, 10, 3600))) throw new HttpError(429, "rate_limited", "Too many requests.");
      const status = await store.subscribe(email((await body(req)).email));
      // The reply says the same thing whatever the status: whether an address
      // is already on this list is not something a stranger gets to find out.
      return json(200, { ok: true, status });
    }

    // — the links inside an email —
    //
    // These are GET requests clicked from a mail client: no session, no
    // Origin, often a different device. A signed token stands in for all of
    // that, and the reply is a small HTML page rather than JSON because a
    // person is looking at it.
    if ((path === "/api/mail/confirm" || path === "/api/mail/unsubscribe") && (method === "GET" || method === "POST")) {
      const secret = mailSecret();
      const purpose = path.endsWith("confirm") ? "confirm" : "unsubscribe";
      const addr = secret ? readToken(secret, purpose, url.searchParams.get("t") ?? "") : null;
      if (!addr) {
        return page(400, "This link is no longer valid", "Confirmation links expire after seven days. Ask for a new one from the site and we'll send a fresh link.");
      }
      if (purpose === "confirm") {
        await store.confirmSubscriber(addr);
        return page(200, "You're subscribed", "The next digest lands at 07:00 IST. Every email has an unsubscribe link at the bottom.");
      }
      await store.unsubscribe(addr);
      // One-click unsubscribe (RFC 8058) POSTs here; a person clicking gets the page.
      return method === "POST" ? json(200, { ok: true }) : page(200, "You're unsubscribed", "No more digests will be sent to this address. You can subscribe again any time from the site.");
    }

    // — everything below needs a session —
    const user = await currentUser(req, store);
    if (!user) throw new HttpError(401, "unauthenticated", "Sign in first.");

    if (path === "/api/saves" && method === "GET") return json(200, { saves: await store.listSaves(user.id) });

    if (path === "/api/saves" && method === "POST") {
      if (!(await store.hit(`write:${user.id}`, 120, 60))) throw new HttpError(429, "rate_limited", "Slow down.");
      const b = await body(req);
      const slug = typeof b.slug === "string" && b.slug ? b.slug : null;
      if (slug !== null && !/^[a-z0-9-]{1,120}$/.test(slug)) throw bad("slug is malformed.");
      await store.addSave(user.id, {
        storyId: str(b.storyId, "storyId", 200),
        title: str(b.title, "title", 300),
        url: httpUrl(b.url),
        source: str(b.source, "source", 60),
        slug,
      });
      return json(200, { ok: true });
    }

    if (path === "/api/saves" && method === "DELETE") {
      await store.removeSave(user.id, str(url.searchParams.get("id"), "id", 200));
      return json(200, { ok: true });
    }

    if (path === "/api/prefs" && method === "PUT") {
      const b = await body(req);
      if (!Array.isArray(b.follows)) throw bad("follows must be a list.");
      const follows = [...new Set(b.follows.filter((t): t is string => typeof t === "string"))];
      if (follows.some((t) => !(TAGS as readonly string[]).includes(t))) throw bad("Unknown tag.");
      if (typeof b.digest !== "boolean") throw bad("digest must be true or false.");
      const updated = await store.setPrefs(user.id, { follows, digest: b.digest });
      return json(200, { user: updated ? publicUser(updated) : null });
    }

    throw new HttpError(404, "not_found", "Not found.");
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code, message: err.message });
    console.error("api error:", err);
    return json(500, { error: "internal", message: "Something went wrong on our side." });
  }
}
