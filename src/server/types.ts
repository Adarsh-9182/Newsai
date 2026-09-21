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

export type SubscriberStatus = "new" | "pending" | "confirmed";

/**
 * The claim key for "this address has been sent its confirmation email".
 * It deliberately carries no date: a confirmation is sent once per
 * subscription, not once per day. Someone who never confirms must not be
 * mailed again tomorrow — they have not consented to anything.
 */
export const CONFIRM_CLAIM = "confirm";

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

  /**
   * The mailing list. An address only receives the digest once it is
   * *confirmed* — the owner clicked a link sent to it — so nobody can enrol
   * someone else's inbox. `subscribe` reports where the address stands:
   * "new" (just added, or re-added after unsubscribing), "pending" (added,
   * never confirmed), or "confirmed" (nothing more to do).
   */
  subscribe(email: string): Promise<SubscriberStatus>;
  confirmSubscriber(email: string): Promise<void>;
  /** Stops all mail to the address, and switches the digest off on any account using it. */
  unsubscribe(email: string): Promise<void>;
  pendingSubscribers(): Promise<string[]>;
  confirmedRecipients(): Promise<string[]>;

  /**
   * Claims the right to send `email` the digest for `date`. True exactly once
   * per pair, which is what makes re-running the sender safe: a crash halfway
   * through a list and a second run does not mail the first half twice.
   */
  claimSend(date: string, email: string): Promise<boolean>;
  /** Gives the claim back when the send failed, so a retry can try again. */
  releaseSend(date: string, email: string): Promise<void>;

  /**
   * Counts one attempt against `key` and says whether it is within `limit`
   * per `windowSec`. Lives in the store, not in memory, because a serverless
   * function forgets everything between invocations.
   */
  hit(key: string, limit: number, windowSec: number): Promise<boolean>;
}
