import { collectAll } from "./sources/index.js";
import { dedupeWithin } from "./dedupe.js";
import { selectStories } from "./rank.js";

// Read-only check: no model credentials, archive writes, or email delivery.
try {
  const { items, failures } = await collectAll();
  const unique = dedupeWithin(items);
  const selected = selectStories(unique, 25);
  const sources: Record<string, number> = {};
  for (const story of selected) sources[story.source] = (sources[story.source] ?? 0) + 1;
  console.log(JSON.stringify({ fetched: items.length, unique: unique.length, selected: selected.length, sources, failures }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
