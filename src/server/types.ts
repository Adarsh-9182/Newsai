/**
 * What the account layer stores, and the one interface it stores it through.
 *
 * `Store` is the seam that keeps the database a late decision. The app in
 * app.ts never imports a driver: it talks to this interface, and there are two
 * implementations — an in-memory one for local work and tests, and a Postgres
 * one that runs unchanged on Neon or Supabase, since both are plain Postgres.
 * Choosing between them is a DATABASE_URL, not a rewrite.
 */

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly createdAt: string;
  /** Tags the user follows; drives the "for you" view. */
  readonly follows: readonly string[];
  /** Whether they want the daily digest by email. */
  readonly digest: boolean;
}

export interface UserWithHash extends User {
  readonly passwordHash: string;
}

/**
 * A saved story is a snapshot, not a reference. The archive is static files,
 * so the account layer has no way to look a story up by id later; keeping the
 * title and link here means the saved list renders without touching it.
 */
export interface Save {
  readonly storyId: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly slug: string | null;
  readonly savedAt: string;
}

export interface Prefs {
  readonly follows: readonly string[];
  readonly digest: boolean;
}

export interface Store {
  /** Returns null when the email is already registered. */
  createUser(u: { email: string; name: string; passwordHash: string }): Promise<User | null>;
  userByEmail(email: string): Promise<UserWithHash | null>;

  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** The user behind a session token hash, if the session exists and has not expired. */
  sessionUser(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;

  listSaves(userId: string): Promise<Save[]>;
  addSave(userId: string, save: Omit<Save, "savedAt">): Promise<void>;
  removeSave(userId: string, storyId: string): Promise<void>;

  setPrefs(userId: string, prefs: Prefs): Promise<User | null>;
  subscribe(email: string): Promise<void>;

  /**
   * Counts one attempt against `key` and says whether it is within `limit`
   * per `windowSec`. Lives in the store, not in memory, because a serverless
   * function forgets everything between invocations.
   */
  hit(key: string, limit: number, windowSec: number): Promise<boolean>;
}
