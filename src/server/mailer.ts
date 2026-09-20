/**
 * Sending mail, behind an interface with three implementations.
 *
 * The provider is Resend, chosen because it is one HTTPS call with no SDK —
 * so this file has no dependency and the whole thing is testable by handing
 * it a different `fetch`. Without RESEND_API_KEY the console mailer prints
 * what would have been sent, which is how the sender can be run end to end
 * locally without mailing anyone.
 */

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /**
   * The List-Unsubscribe pair. Gmail and Outlook show a one-click unsubscribe
   * when these are present, and treat bulk mail without them as more likely to
   * be spam — so the polite thing and the deliverable thing agree.
   */
  readonly unsubscribeUrl?: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
  readonly name: string;
}

/** Where mail appears to come from. Must be a domain verified with the provider. */
export const mailFrom = (): string => process.env.NEWSAI_MAIL_FROM ?? "newsai <digest@newsai.co.in>";

export function consoleMailer(): Mailer {
  return {
    name: "console",
    async send(mail) {
      console.log(`\n── would send ─────────────────────────────\nTo:      ${mail.to}\nSubject: ${mail.subject}\n${mail.text.slice(0, 500)}\n───────────────────────────────────────────\n`);
    },
  };
}

export function resendMailer(apiKey: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    name: "resend",
    async send(mail) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: mailFrom(),
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          ...(mail.unsubscribeUrl
            ? { headers: { "List-Unsubscribe": `<${mail.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
            : {}),
        }),
      });
      if (!res.ok) {
        // The body carries the provider's reason; the address must not be
        // marked as sent when it was not, so this throws and the caller releases the claim.
        throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
    },
  };
}

export function mailerFromEnv(): Mailer {
  const key = process.env.RESEND_API_KEY;
  return key ? resendMailer(key) : consoleMailer();
}
