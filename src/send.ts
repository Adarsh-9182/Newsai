/**
 * Sends one day's digest to everyone who confirmed their address.
 *
 * Run after the digest is written, from the same workflow:
 *
 *   node dist/send.js            # today
 *   node dist/send.js 2026-09-20 # a specific day
 *
 * Two properties matter more than speed. It is idempotent: each address is
 * claimed in the database before it is mailed, so re-running after a crash
 * mails only who is left. And it fails closed: no DATABASE_URL, no mail
 * secret, or mail provider stops real delivery. Missing editions still allow
 * pending confirmation retries; explicit dry-runs never change delivery claims.
 */

import { readArchive, today } from "./archive.js";
import { storeFromEnv } from "./server/store/index.js";
import { mailerFromEnv, consoleMailer, Mailer } from "./server/mailer.js";
import { digestEmail, confirmEmail } from "./server/emails.js";
import { mailSecret, confirmUrl, unsubscribeUrl } from "./server/maillink.js";
import { sendConfirmation } from "./server/confirmation.js";
import { SITE_URL } from "./ui/layout.js";
import { Store } from "./server/types.js";
import { Digest } from "./types.js";
import { hashToken } from "./server/crypto.js";

/** A pause between sends, to stay under a provider's per-second limit. */
const GAP_MS = Number(process.env.NEWSAI_SEND_GAP_MS ?? 600);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SendOptions {
  dryRun?: boolean;
  store?: Store;
  mailer?: Mailer;
  digest?: Digest;
  secret?: string;
  gapMs?: number;
}

export async function send(date = today(), options: SendOptions = {}): Promise<{ sent: number; failed: number; confirmations: number; previewed: number }> {
  const secret = options.secret ?? mailSecret();
  if (!secret) throw new Error("NEWSAI_MAIL_SECRET is not set (needs at least 16 characters) — refusing to send.");
  if (!options.store && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set — refusing an in-memory subscriber list.");
  if (!options.dryRun && !options.mailer && !process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is missing; use --dry-run to preview without changing delivery state.");
  const gap = options.gapMs ?? GAP_MS;
  if (!Number.isFinite(gap) || gap < 0) throw new Error("NEWSAI_SEND_GAP_MS must be a non-negative number.");

  const store = options.store ?? await storeFromEnv();
  if (!store) throw new Error("DATABASE_URL is not set — there is no subscriber list to send to.");

  const digest = options.digest ?? (await readArchive()).find((d) => d.date === date);

  const mailer = options.mailer ?? (options.dryRun ? consoleMailer() : mailerFromEnv());
  if (options.dryRun) {
    let previewed = 0;
    for (const email of await store.pendingSubscribers()) {
      const generation = await store.confirmationGeneration(email);
      if (!generation) continue;
      await mailer.send({ to: email, ...confirmEmail(confirmUrl(SITE_URL, secret, email, generation)) });
      previewed++;
    }
    if (digest?.stories.length) for (const email of await store.confirmedRecipients()) {
      const unsub = unsubscribeUrl(SITE_URL, secret, email);
      await mailer.send({ to: email, ...digestEmail(digest, SITE_URL, unsub), unsubscribeUrl: unsub });
      previewed++;
    }
    console.log(`Previewed ${previewed} emails; no delivery claims were changed.`);
    return { sent: 0, failed: 0, confirmations: 0, previewed };
  }
  console.log(`Sending ${date} via ${mailer.name} as ${SITE_URL}`);

  // Anyone who asked but never confirmed gets the confirmation, not the digest.
  let confirmations = 0;
  let failed = 0;
  for (const email of await store.pendingSubscribers()) {
    // Dateless: one confirmation per subscription, not one per day.
    try {
      if (await sendConfirmation(store, email, SITE_URL, secret, mailer)) confirmations += 1;
    } catch (err) {
      failed += 1;
      console.warn(`  confirmation delivery failed (recipient ${hashToken(email).slice(0, 12)})`);
    }
    await sleep(gap);
  }

  if (!digest || digest.stories.length === 0) {
    console.log(`${date} has no digest; pending confirmations were processed.`);
    return { sent: 0, failed, confirmations, previewed: 0 };
  }

  let sent = 0;
  for (const email of await store.confirmedRecipients()) {
    // The claim is what makes a re-run safe: whoever is already claimed is skipped.
    if (!(await store.claimSend(date, email))) continue;
    const unsub = unsubscribeUrl(SITE_URL, secret, email);
    try {
      const mail = digestEmail(digest, SITE_URL, unsub);
      await mailer.send({ to: email, subject: mail.subject, html: mail.html, text: mail.text, unsubscribeUrl: unsub });
      sent += 1;
    } catch (err) {
      // Give the claim back so a later run retries this address.
      await store.releaseSend(date, email);
      failed += 1;
      console.warn(`  digest delivery failed (recipient ${hashToken(email).slice(0, 12)})`);
    }
    await sleep(gap);
  }

  console.log(`Sent ${sent} digest(s), ${confirmations} confirmation(s), ${failed} failure(s).`);
  return { sent, failed, confirmations, previewed: 0 };
}

if (process.argv[1]?.endsWith("send.js")) {
  send(process.argv.slice(2).find((arg) => !arg.startsWith("--")), { dryRun: process.argv.includes("--dry-run") }).then((result) => {
    if (result.failed > 0) process.exitCode = 1;
  }).catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  });
}
