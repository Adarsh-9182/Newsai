/**
 * The long read — a deeper pass over the few stories that earn one.
 *
 * Sonnet 5 here, where the summariser uses Haiku, and the split is the point.
 * Compressing an abstract is mechanical; saying what a release changes for
 * someone building with it is judgement, and judgement is the one thing on
 * this site worth paying for. Rationing it to the top few stories is what
 * keeps that affordable: depth on four items costs less than shallow
 * summaries on forty would if they were written this way.
 *
 * The model still has not read the linked page — it sees the title and the
 * abstract, the same evidence the summariser had. So the prompt's hardest
 * instruction is about the caveats field: say what the item does not
 * establish. An analysis that only amplifies is how a news site starts
 * inventing significance, and the caveats line is the structural defence
 * against it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Story, Analysis } from "./types.js";

/** Judgement, not compression — worth more than the summariser's model. */
const DEFAULT_MODEL = "claude-sonnet-5";

const SYSTEM = [
  "You write the analysis section of a daily AI newsletter read by engineers",
  "and founders who build with AI, most of them in India.",
  "",
  "You are given ONE item: its title, source, and abstract or blurb.",
  "",
  "Write four fields:",
  "  what      — 2-4 sentences. What was actually built, measured or announced.",
  "              Concrete. If it is a paper, what did it test and what did it find?",
  "  soWhat    — 2-4 sentences. What this changes for someone building with AI.",
  "              Be specific about who it affects and how. If the honest answer",
  "              is 'very little, this is incremental', write that.",
  "  caveats   — 2-3 sentences on what this item does NOT establish: what was",
  "              not measured, what the blurb leaves out, where the claim is the",
  "              author's rather than a result. This field is mandatory and must",
  "              never be empty or flattering.",
  "  takeaways — 2-4 short lines (under 15 words each) a reader could act on.",
  "              Empty array if there is genuinely nothing to act on.",
  "",
  "Rules you must not break:",
  "  - You have NOT read the linked page. Use only the title and text given.",
  "  - Never invent a benchmark number, a date, a price, a company or a name",
  "    that is not in front of you. If you want to cite a figure and it is not",
  "    in the text, leave it out.",
  "  - No hype vocabulary: no 'groundbreaking', 'revolutionary', 'game-changing'.",
  "  - Most things are incremental. Saying so is the useful answer, not a failure.",
  "",
  'Reply with ONLY a JSON object:',
  '{"what":"...","soWhat":"...","caveats":"...","takeaways":["..."]}',
].join("\n");

export interface AnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

function parseAnalysis(raw: string): Analysis | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as Partial<Analysis>;
    const what = o.what?.trim();
    const soWhat = o.soWhat?.trim();
    const caveats = o.caveats?.trim();
    // All three prose fields or none: a half-written analysis reads worse
    // than the summary it was supposed to deepen.
    if (!what || !soWhat || !caveats) return null;
    return {
      what,
      soWhat,
      caveats,
      takeaways: (o.takeaways ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 4),
    };
  } catch {
    return null;
  }
}

/**
 * Analyses the first `depth` stories, which are already in ranked order.
 * Returns every story, with `analysis` attached to the ones that got one.
 */
export async function analyseTop(
  stories: readonly Story[],
  depth: number,
  client: Anthropic = new Anthropic(),
): Promise<{ stories: Story[]; usage: AnalysisUsage }> {
  const model = process.env.NEWSAI_ANALYSIS_MODEL ?? DEFAULT_MODEL;
  const usage: AnalysisUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  const out = [...stories];

  for (let i = 0; i < Math.min(depth, out.length); i++) {
    const s = out[i];
    if (!s) continue;
    const prompt = `Title: ${s.title}\nSource: ${s.source}\n\n${s.text ?? s.summary}`;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2000,
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
      const analysis = parseAnalysis(text);
      // No analysis is fine — the story keeps its summary and its card.
      if (analysis) out[i] = { ...s, analysis };
    } catch (err) {
      console.warn(`  analysis failed for "${s.title.slice(0, 50)}": ${err}`);
    }
  }
  return { stories: out, usage };
}
