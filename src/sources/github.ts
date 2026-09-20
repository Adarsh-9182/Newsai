/**
 * GitHub — new repositories people are starring.
 *
 * There is no official trending API, so this asks the search API for
 * recently-created repositories under agent-ish topics, sorted by stars.
 *
 * One query per topic, not one query listing every topic. GitHub ANDs
 * repeated `topic:` qualifiers, so `topic:ai-agents topic:llm topic:agentic-ai`
 * asks for repositories carrying all three and reliably returns nothing —
 * which it did, silently, until someone checked total_count. There is no OR
 * form for qualifiers, so the union is assembled client-side.
 *
 * Stars on a young repository are a better signal for this site than stars
 * overall: a two-year-old framework with 40k stars is not news, and a
 * fortnight-old one with 400 is.
 */

import { RawItem } from "../types.js";

const ENDPOINT = "https://api.github.com/search/repositories";
const TOPICS = ["ai-agents", "agentic-ai", "llm", "mcp"] as const;
/** Below this, a new repo is someone's weekend, not a story. */
const MIN_STARS = 120;
/** Anonymous search allows ten a minute; four topics never approaches it. */
const PER_TOPIC = 8;

interface Repo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  created_at: string;
}

async function searchTopic(topic: string, since: string): Promise<Repo[]> {
  const q = `topic:${topic} created:>${since} stars:>${MIN_STARS}`;
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_TOPIC}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "newsai.co.in" },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} for topic:${topic}`);
  const data = (await res.json()) as { items?: Repo[] };
  return data.items ?? [];
}

export async function fetchGithub(daysBack = 21): Promise<RawItem[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);

  // One topic being rate-limited or renamed should not cost the others.
  const settled = await Promise.allSettled(TOPICS.map((t) => searchTopic(t, since)));
  const repos = new Map<number, Repo>();
  for (const r of settled) {
    if (r.status === "fulfilled") for (const repo of r.value) repos.set(repo.id, repo);
  }
  if (repos.size === 0 && settled.every((r) => r.status === "rejected")) {
    throw new Error(`every GitHub topic query failed`);
  }

  return [...repos.values()].map((r) => ({
    id: `gh:${r.id}`,
    title: r.full_name,
    url: r.html_url,
    source: "GitHub",
    publishedAt: r.created_at,
    signal: r.stargazers_count,
    ...(r.description ? { text: r.description } : {}),
  }));
}
