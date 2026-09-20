/**
 * The only place this project spends money.
 *
 * Haiku 4.5 by default, deliberately. The job is compression, not judgement:
 * the model is handed a title and an abstract and asked to say what they say,
 * shorter. Paying five times as much for deeper reasoning buys very little on
 * that task, and this site's whole economics rest on a daily run costing
 * paise rather than rupees. NEWSAI_MODEL overrides it if the summaries ever
 * read badly.
 *
 * Two things keep the bill flat regardless of how busy the news is: items are
 * summarised in batches, so twenty-five stories are a handful of requests
 * rather than twenty-five, and NEWSAI_MAX_STORIES caps the run before it
 * starts. A dramatic AI news day costs the same as a quiet one.
 *
 * The model is never asked to *rank*. What leads the page is decided by
 * signal, in the pipeline, from HN points and stars — numbers that already
 * exist. Asking a model to score importance would be paying it to guess at
 * something the sources already measured.
 */

import Anthropic from "@anthropic-ai/sdk";
import { RawItem, Story } from "./types.js";

/** Cheapest model that can compress an abstract. Override with NEWSAI_MODEL. */
const DEFAULT_MODEL = "claude-haiku-4-5";
/** Items per request. Large enough to amortise the instructions, small
 *  enough that one malformed reply costs a handful of stories, not the day. */
const BATCH = 8;

const SYSTEM = [
  "You write a daily AI news digest read by software engineers and founders in India.",
  "For each numbered item you are given a title and, usually, an abstract or blurb.",
  "",
  "Write, for each item:",
  "  summary — 1-2 plain sentences saying what it is. No hype, no adjectives like",
  "            'groundbreaking'. If it is a paper, say what it measured or built.",
  "  why     — one short sentence on why someone building with AI should care.",
  "            If it is routine, say so plainly. Not everything matters.",
  "  tags    — 1-3 lowercase tags from: agents, models, research, tools, infra,",
  "            funding, policy, india.",
  "",
  "Rules you must not break:",
  "  - Use ONLY what the provided title and text say. You have not read the",
  "    linked page. Never add a number, benchmark, date, company or claim that",
  "    is not in front of you.",
  "  - If the text is too thin to summarise, set summary to the title restated",
  "    plainly and why to 'Not enough detail in the feed to judge.'",
  "",
  'Reply with ONLY a JSON array, one object per item, in the same order:',
  '[{"i":1,"summary":"...","why":"...","tags":["agents"]}]',
].join("\n");

export interface SummaryUsage {
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

interface Reply {
  i?: number;
  summary?: string;
  why?: string;
  tags?: string[];
}

/** Pulls the JSON array out of a reply that may be fenced or prefaced. */
function parseReplies(raw: string): Reply[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? (parsed as Reply[]) : [];
  } catch {
    return [];
  }
}

const ALLOWED_TAGS = new Set(["agents", "models", "research", "tools", "infra", "funding", "policy", "india"]);

async function summariseBatch(
  client: Anthropic,
  model: string,
  batch: readonly RawItem[],
  usage: SummaryUsage,
): Promise<Story[]> {
  const prompt = batch
    .map((it, n) => `${n + 1}. [${it.source}] ${it.title}\n${it.text ?? "(no description provided)"}`)
    .join("\n\n");

  const response = await client.messages.create({
    model,
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  usage.requests += 1;
  usage.inputTokens += response.usage.input_tokens ?? 0;
  usage.outputTokens += response.usage.output_tokens ?? 0;

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const replies = parseReplies(text);
  return batch.flatMap((item, n): Story[] => {
    // Match on the model's own index where it gave one, else by position.
    const r = replies.find((x) => x.i === n + 1) ?? replies[n];
    const summary = r?.summary?.trim();
    // A story the model did not return is dropped rather than published bare:
    // a card with no summary is worse than one fewer card.
    if (!summary) return [];
    return [
      {
        ...item,
        summary,
        why: r?.why?.trim() || "",
        tags: (r?.tags ?? []).map((t) => t.toLowerCase()).filter((t) => ALLOWED_TAGS.has(t)).slice(0, 3),
      },
    ];
  });
}

export async function summarise(
  items: readonly RawItem[],
  client: Anthropic = new Anthropic(),
): Promise<{ stories: Story[]; usage: SummaryUsage }> {
  const model = process.env.NEWSAI_MODEL ?? DEFAULT_MODEL;
  const usage: SummaryUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  const stories: Story[] = [];

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    try {
      stories.push(...(await summariseBatch(client, model, batch, usage)));
    } catch (err) {
      // One failed batch must not cost the whole digest.
      console.warn(`  batch ${i / BATCH + 1} failed: ${err}`);
    }
  }
  return { stories, usage };
}
