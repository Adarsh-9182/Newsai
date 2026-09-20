/**
 * The emails themselves, as HTML and plain text.
 *
 * Mail clients are not browsers: Gmail strips <style> blocks, Outlook renders
 * through Word, and nothing supports the CSS this site's pages are built with.
 * So these templates use a table, inline styles, web-safe fonts and no images.
 * The result is plainer than the site on purpose — it survives everywhere.
 *
 * Every template returns text as well as HTML. A text part is not decoration:
 * without one, bulk mail is scored as more likely to be spam, and text-only
 * clients get a blank message.
 */

import { Digest, Story } from "../types.js";
import { esc, longDate } from "../ui/layout.js";

const INK = "#1e1e1e";
const DIM = "#6b6b68";
const LINE = "#e6e6e3";
const TEAL = "#077f76";

const shell = (title: string, inner: string, footer: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:12px">
<tr><td style="padding:28px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK}">
${inner}
</td></tr>
<tr><td style="padding:18px 30px 24px;border-top:1px solid ${LINE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${DIM}">
${footer}
</td></tr>
</table>
</td></tr></table>
</body></html>`;

export interface Email {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/**
 * The address has asked for the digest but has not proved it owns the inbox.
 * Nothing else is ever sent until this link is clicked.
 */
export function confirmEmail(confirmLink: string): Email {
  const html = shell(
    "Confirm your subscription",
    `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">Confirm your subscription</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${INK}">
       Someone (hopefully you) asked for the <strong>newsai</strong> daily digest &mdash; the day's AI
       stories with an honest note on what each one doesn't prove, at 07:00 IST.</p>
     <p style="margin:0 0 24px"><a href="${esc(confirmLink)}" style="display:inline-block;padding:12px 22px;background:${INK};color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">Confirm subscription</a></p>
     <p style="margin:0;font-size:13px;line-height:1.6;color:${DIM}">The link works for 7 days. If you didn't ask for this, ignore this email &mdash; nothing will be sent.</p>`,
    `You received this once, to confirm an address. No further mail is sent unless you confirm.`,
  );
  const text = `Confirm your subscription to the newsai daily digest.\n\n${confirmLink}\n\nThe link works for 7 days. If you didn't ask for this, ignore this email — nothing will be sent.\n`;
  return { subject: "Confirm your newsai subscription", html, text };
}

const storyBlock = (s: Story, site: string): string => {
  const href = s.analysis && s.slug ? `${site}/story/${s.slug}/` : s.url;
  const deep = Boolean(s.analysis);
  return `<tr><td style="padding:0 0 22px">
  <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${DIM};padding-bottom:5px">
    ${esc(s.source)}${s.signal > 0 ? ` &middot; ${s.signal.toLocaleString("en-IN")} ${s.source === "GitHub" ? "stars" : "pts"}` : ""}${deep ? ` &middot; <span style="color:${TEAL}">analysis</span>` : ""}
  </div>
  <a href="${esc(href)}" style="font-size:17px;line-height:1.3;font-weight:600;color:${INK};text-decoration:none">${esc(s.title)}</a>
  <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#3a3a38">${esc(s.summary)}</p>
  ${s.why ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:${DIM};border-left:2px solid ${LINE};padding-left:10px">${esc(s.why)}</p>` : ""}
</td></tr>`;
};

/**
 * One day's digest. Deep reads first, then the rest — the same order the site
 * uses, which is the sources' own ranking rather than anything a model chose.
 */
export function digestEmail(digest: Digest, site: string, unsubscribeLink: string): Email {
  const deep = digest.stories.filter((s) => s.analysis);
  const rest = digest.stories.filter((s) => !s.analysis);
  const date = longDate(digest.date);

  const section = (label: string, items: readonly Story[]) =>
    items.length
      ? `<tr><td style="padding:8px 0 14px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${DIM};border-top:1px solid ${LINE}">${label}</td></tr>
         ${items.map((s) => storyBlock(s, site)).join("")}`
      : "";

  const html = shell(
    `newsai — ${date}`,
    `<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${DIM}">newsai &middot; ${esc(date)}</div>
     <h1 style="margin:8px 0 20px;font-size:22px;line-height:1.25">${digest.stories.length} stories, ${deep.length} analysed</h1>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
       ${section("The long reads", deep)}
       ${section("Also today", rest)}
     </table>
     <p style="margin:6px 0 0"><a href="${esc(site)}/" style="font-size:14px;color:${TEAL};text-decoration:none;font-weight:600">Read on the site &rarr;</a></p>`,
    `Summaries and analysis are written by a language model from each item's own title and abstract &mdash;
     it has not read the linked page &mdash; and can be wrong. Follow the link before you rely on anything.<br><br>
     <a href="${esc(unsubscribeLink)}" style="color:${DIM}">Unsubscribe</a>`,
  );

  const line = (s: Story) =>
    `- ${s.title}\n  ${s.analysis && s.slug ? `${site}/story/${s.slug}/` : s.url}\n  ${s.summary}\n`;
  const text = `newsai — ${date}\n${digest.stories.length} stories, ${deep.length} analysed\n\n${
    deep.length ? `THE LONG READS\n${deep.map(line).join("\n")}\n` : ""
  }${rest.length ? `ALSO TODAY\n${rest.map(line).join("\n")}\n` : ""}
Summaries are model-written from each item's title and abstract and can be wrong.
Unsubscribe: ${unsubscribeLink}\n`;

  return { subject: `newsai — ${date}: ${deep[0]?.title ?? `${digest.stories.length} stories`}`.slice(0, 120), html, text };
}
