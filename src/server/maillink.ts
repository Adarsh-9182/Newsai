/**
 * The links inside an email: confirm and unsubscribe.
 *
 * A link is `<purpose>.<email>.<expiry>.<signature>`, signed with HMAC-SHA256
 * under NEWSAI_MAIL_SECRET. Nothing is stored to make one and nothing is
 * looked up to check one, which matters because the click may arrive days
 * later, from a mail client, with no session and no cookie.
 *
 * The purpose is inside the signed payload, so a confirm link cannot be filed
 * down into an unsubscribe link or the other way round. Unsubscribe links do
 * not expire: an old newsletter must still work, or the only way out of the
 * list is to mark it as spam.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type Purpose = "confirm" | "unsubscribe";

/** Days a confirm link stays valid. Long enough to survive a weekend. */
const CONFIRM_DAYS = 7;

const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string): string => Buffer.from(s, "base64url").toString("utf8");

const sign = (secret: string, payload: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64url");

/**
 * The secret. There is deliberately no default: a fallback would mean links
 * signed with a value that is public in this repository, and anyone could then
 * forge a confirmation for an address they do not own.
 */
export function mailSecret(): string | null {
  const s = process.env.NEWSAI_MAIL_SECRET;
  return s && s.length >= 16 ? s : null;
}

export function makeToken(secret: string, purpose: Purpose, email: string): string {
  const expires = purpose === "confirm" ? Date.now() + CONFIRM_DAYS * 86_400_000 : 0;
  const payload = `${purpose}.${b64(email)}.${expires}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** The email a valid token is for, or null. Never throws on malformed input. */
export function readToken(secret: string, purpose: Purpose, token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [p, e, exp, mac] = parts as [string, string, string, string];
  if (p !== purpose) return null;

  const expected = Buffer.from(sign(secret, `${p}.${e}.${exp}`), "utf8");
  const actual = Buffer.from(mac, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const expires = Number(exp);
  if (!Number.isFinite(expires)) return null;
  if (expires !== 0 && Date.now() > expires) return null;

  try {
    const email = unb64(e);
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

export const confirmUrl = (site: string, secret: string, email: string): string =>
  `${site}/api/mail/confirm?t=${encodeURIComponent(makeToken(secret, "confirm", email))}`;

export const unsubscribeUrl = (site: string, secret: string, email: string): string =>
  `${site}/api/mail/unsubscribe?t=${encodeURIComponent(makeToken(secret, "unsubscribe", email))}`;
