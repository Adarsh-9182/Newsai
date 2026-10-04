import { Store, CONFIRM_CLAIM } from "./types.js";
import { Mailer } from "./mailer.js";
import { confirmEmail } from "./emails.js";
import { confirmUrl } from "./maillink.js";

/** Shared by the API and scheduled retry job; only one can claim an address. */
export async function sendConfirmation(store: Store, email: string, site: string, secret: string, mailer: Mailer, resend = false): Promise<boolean> {
  const generation = await store.confirmationGeneration(email);
  if (!generation) return false;
  const claim = resend ? `${CONFIRM_CLAIM}-resend:${generation}:${Math.floor(Date.now() / 3_600_000)}` : CONFIRM_CLAIM;
  if (!(await store.claimSend(claim, email))) return false;
  try {
    const mail = confirmEmail(confirmUrl(site, secret, email, generation));
    await mailer.send({ to: email, ...mail });
    return true;
  } catch (err) {
    await store.releaseSend(claim, email);
    throw err;
  }
}
