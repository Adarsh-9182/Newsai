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
 * secret, or no digest for the day and it sends nothing at all rather than
 * sending something wrong.
 */

import { readArchive, today } from "./archive.js";
import { storeFromEnv } from "./server/store/index.js";
import { mailerFromEnv } from "./server/mailer.js";
import { digestEmail, confirmEmail } from "./server/emails.js";
import { mailSecret, confirmUrl, unsubscribeUrl } from "./server/maillink.js";
import { SITE_URL } from "./ui/layout.js";

/** A pause between sends, to stay under a provider's per-second limit. */
const GAP_MS = Number(process.env.NEWSAI_SEND_GAP_MS ?? 120);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function send(date = today()): Promise<{ sent: number; failed: number; confirmations: number }> {
  const secret = mailSecret();
  if (!secret) throw new Error("NEWSAI_MAIL_SECRET is not set (needs at least 16 characters) — refusing to send.");

  const store = await storeFromEnv();
  if (!store) throw new Error("DATABASE_URL is not set — there is no subscriber list to send to.");

  const digest = (await readArchive()).find((d) => d.date === date);
  if (!digest) throw new Error(`No digest for ${date}. Run the pipeline first.`);
  if (digest.stories.length === 0) {
    console.log(`${date} has no stories — nothing to send.`);
    return { sent: 0, failed: 0, confirmations: 0 };
  }

  const mailer = mailerFromEnv();
  console.log(`Sending ${date} via ${mailer.name} as ${SITE_URL}`);

  // Anyone who asked but never confirmed gets the confirmation, not the digest.
  let confirmations = 0;
  for (const email of await store.pendingSubscribers()) {
    if (!(await store.claimSend(`confirm:${date}`, email))) continue;
    try {
      const mail = confirmEmail(confirmUrl(SITE_URL, secret, email));
      await mailer.send({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
      confirmations += 1;
    } catch (err) {
      await store.releaseSend(`confirm:${date}`, email);
      console.warn(`  confirmation to ${email} failed: ${err}`);
    }
    await sleep(GAP_MS);
  }

  let sent = 0;
  let failed = 0;
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
      console.warn(`  ${email} failed: ${err}`);
    }
    await sleep(GAP_MS);
  }

  console.log(`Sent ${sent} digest(s), ${confirmations} confirmation(s), ${failed} failure(s).`);
  return { sent, failed, confirmations };
}

if (process.argv[1]?.endsWith("send.js")) {
  send(process.argv[2]).catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  });
}
