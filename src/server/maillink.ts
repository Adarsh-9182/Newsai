/**
 * The links inside an email: confirm and unsubscribe.
 *
 * Signed links carry purpose, address and expiry. Confirmations also carry
 * the current subscription generation, checked against the database on click.
 * A deleted or unsubscribed address can never be restored by an old link.
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

export function makeToken(secret: string, purpose: Purpose, email: string, generation?: string): string {
  const expires = purpose === "confirm" ? Date.now() + CONFIRM_DAYS * 86_400_000 : 0;
  const payload = `${purpose}.${b64(email)}.${expires}${generation ? `.${generation}` : ""}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** The email a valid token is for, or null. Never throws on malformed input. */
export function readToken(secret: string, purpose: Purpose, token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 4 && parts.length !== 5) return null;
  const [p, e, exp] = parts as [string, string, string];
  const mac = parts[parts.length - 1]!;
  if (p !== purpose) return null;

  const expected = Buffer.from(sign(secret, parts.slice(0, -1).join(".")), "utf8");
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

export function confirmationGeneration(secret: string, token: string): string | null {
  if (!readToken(secret, "confirm", token)) return null;
  const parts = token.split(".");
  const generation = parts.length === 5 ? parts[3]! : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(generation) ? generation : null;
}

export const confirmUrl = (site: string, secret: string, email: string, generation?: string): string =>
  `${site}/api/mail/confirm?t=${encodeURIComponent(makeToken(secret, "confirm", email, generation))}`;

export const unsubscribeUrl = (site: string, secret: string, email: string): string =>
  `${site}/api/mail/unsubscribe?t=${encodeURIComponent(makeToken(secret, "unsubscribe", email))}`;
