/**
 * Password hashing and session tokens, using only node:crypto.
 *
 * scrypt is memory-hard and ships with Node, so there is no native module to
 * break a Vercel build and nothing to keep patched. The parameters travel with
 * each hash, which is what lets them be raised later without locking anyone
 * out: old hashes verify under the parameters they were made with.
 */

import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Constant-time. Returns false — never throws — for a malformed stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "base64");
    const actual = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * A hash to check against when the email is unknown, so "no such user" and
 * "wrong password" cost the same time and cannot be told apart by timing.
 */
export const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;

/** 256 bits from the OS. This is what goes in the cookie. */
export const newToken = (): string => randomBytes(32).toString("base64url");

/**
 * The database only ever holds the hash of a session token, so a leaked
 * backup or a read-only SQL injection cannot be replayed as a login.
 */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
