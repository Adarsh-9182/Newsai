/**
 * Postgres Store. One implementation for Neon and Supabase, because both are
 * Postgres and this file only speaks SQL.
 *
 * It is written against a two-line `Db` interface rather than a driver, so the
 * exact same SQL is exercised in tests by PGlite (Postgres compiled to WASM)
 * and in production by postgres.js. Every value goes in as a bound parameter;
 * nothing user-supplied is ever concatenated into a query.
 */

import { Store, User, UserWithHash, Save, CONFIRM_CLAIM } from "../types.js";
import { SCHEMA } from "./schema.js";

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  follows: string[];
  digest: boolean;
  created_at: Date | string;
}

const iso = (d: Date | string): string => new Date(d).toISOString();

const toUser = (r: UserRow): User => ({
  id: r.id, email: r.email, name: r.name, follows: r.follows ?? [], digest: r.digest, createdAt: iso(r.created_at),
});
const toUserWithHash = (r: UserRow): UserWithHash => ({ ...toUser(r), passwordHash: r.password_hash });

const USER_COLS = "id, email, name, password_hash, follows, digest, created_at";

export async function migrate(db: Db): Promise<void> {
  // One statement per call: several drivers refuse multi-statement parameterless
  // queries in extended mode, and this way a failure names its statement.
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
}

export function postgresStore(db: Db): Store {
  return {
    async createUser({ email, name, passwordHash }) {
      const rows = await db.query<UserRow>(
        `insert into users (id, email, name, password_hash) values (gen_random_uuid(), $1, $2, $3)
         on conflict (email) do nothing returning ${USER_COLS}`,
        [email, name, passwordHash],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },
    async userByEmail(email) {
      const rows = await db.query<UserRow>(`select ${USER_COLS} from users where email = $1`, [email]);
      return rows[0] ? toUserWithHash(rows[0]) : null;
    },

    async createSession(userId, tokenHash, expiresAt) {
      await db.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
        tokenHash, userId, expiresAt.toISOString(),
      ]);
      // Housekeeping rides along with a write instead of needing a cron job.
      await db.query("delete from sessions where expires_at < now()");
    },
    async sessionUser(tokenHash) {
      const rows = await db.query<UserRow>(
        `select u.id, u.email, u.name, u.password_hash, u.follows, u.digest, u.created_at
           from sessions s join users u on u.id = s.user_id
          where s.token_hash = $1 and s.expires_at > now()`,
        [tokenHash],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },
    async deleteSession(tokenHash) {
      await db.query("delete from sessions where token_hash = $1", [tokenHash]);
    },

    async listSaves(userId) {
      const rows = await db.query<{ story_id: string; title: string; url: string; source: string; slug: string | null; saved_at: Date | string }>(
        "select story_id, title, url, source, slug, saved_at from saves where user_id = $1 order by saved_at desc",
        [userId],
      );
      return rows.map((r): Save => ({
        storyId: r.story_id, title: r.title, url: r.url, source: r.source, slug: r.slug, savedAt: iso(r.saved_at),
      }));
    },
    async addSave(userId, s) {
      await db.query(
        `insert into saves (user_id, story_id, title, url, source, slug) values ($1, $2, $3, $4, $5, $6)
         on conflict (user_id, story_id) do nothing`,
        [userId, s.storyId, s.title, s.url, s.source, s.slug],
      );
    },
    async removeSave(userId, storyId) {
      await db.query("delete from saves where user_id = $1 and story_id = $2", [userId, storyId]);
    },

    async setPrefs(userId, prefs) {
      const rows = await db.query<UserRow>(
        `update users set follows = $2::text[], digest = $3 where id = $1 returning ${USER_COLS}`,
        [userId, [...prefs.follows], prefs.digest],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },
    async subscribe(email) {
      const [row] = await db.query<{ confirmed_at: Date | null; unsubscribed_at: Date | null }>(
        "select confirmed_at, unsubscribed_at from subscribers where email = $1",
        [email],
      );
      if (row && !row.unsubscribed_at) return row.confirmed_at ? "confirmed" : "pending";
      await db.query(
        `insert into subscribers (email) values ($1)
         on conflict (email) do update set confirmed_at = null, unsubscribed_at = null, created_at = now()`,
        [email],
      );
      // A fresh subscription earns exactly one confirmation email. Clearing the
      // claim here — and only here — is what stops an address that never
      // confirms from being mailed again every day.
      await db.query("delete from digest_sends where date = $1 and email = $2", [CONFIRM_CLAIM, email]);
      return "new";
    },
    async confirmSubscriber(email) {
      await db.query(
        `insert into subscribers (email, confirmed_at) values ($1, now())
         on conflict (email) do update set confirmed_at = now(), unsubscribed_at = null`,
        [email],
      );
    },
    async unsubscribe(email) {
      await db.query("update subscribers set unsubscribed_at = now() where email = $1 and unsubscribed_at is null", [email]);
      await db.query("update users set digest = false where email = $1", [email]);
    },
    async pendingSubscribers() {
      const rows = await db.query<{ email: string }>(
        "select email from subscribers where confirmed_at is null and unsubscribed_at is null order by created_at",
      );
      return rows.map((r) => r.email);
    },
    async confirmedRecipients() {
      const rows = await db.query<{ email: string }>(
        "select email from subscribers where confirmed_at is not null and unsubscribed_at is null order by email",
      );
      return rows.map((r) => r.email);
    },
    async claimSend(date, email) {
      const rows = await db.query(
        "insert into digest_sends (date, email) values ($1, $2) on conflict do nothing returning email",
        [date, email],
      );
      return rows.length === 1;
    },
    async releaseSend(date, email) {
      await db.query("delete from digest_sends where date = $1 and email = $2", [date, email]);
    },

    async hit(key, limit, windowSec) {
      const rows = await db.query<{ count: number }>(
        `insert into rate_limits (key, count, reset_at) values ($1, 1, now() + make_interval(secs => $2::double precision))
         on conflict (key) do update set
           count    = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
           reset_at = case when rate_limits.reset_at < now() then now() + make_interval(secs => $2::double precision)
                           else rate_limits.reset_at end
         returning count`,
        [key, windowSec],
      );
      return Number(rows[0]?.count ?? 1) <= limit;
    },
  };
}
