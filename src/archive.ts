/**
 * The archive is the database.
 *
 * One JSON file per day in data/, committed to the repository. There is no
 * database because there is no state a database would hold: the digests are
 * append-only, a few kilobytes each, and read whole. Committing them means
 * the history of the site is the history of the repo, hosting costs nothing,
 * and a bad run is reverted with git rather than repaired with SQL.
 */

import { readFile, readdir, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Digest } from "./types.js";

/**
 * Where the digests live. Overridable so a preview or a test can point at a
 * scratch directory and never risk writing sample data into the real archive,
 * which is committed and published.
 */
export const DATA_DIR = (process.env.NEWSAI_DATA_DIR ?? new URL("../data/", import.meta.url).pathname).replace(/\/?$/, "/");

export const today = (): string => new Date().toISOString().slice(0, 10);

async function readDays(days: string[], dir = DATA_DIR): Promise<Digest[]> {
  const digests: Digest[] = [];
  // Bound concurrency so a long-running archive doesn't exhaust file handles.
  for (let i = 0; i < days.length; i += 64) {
    const chunk = days.slice(i, i + 64);
    const results = await Promise.all(chunk.map(async (name) => {
      try { return { name, value: JSON.parse(await readFile(join(dir, name), "utf8")) as Digest }; }
      catch (err) { console.warn(`  skipping unreadable ${name}: ${err}`); return null; }
    }));
    for (const result of results) if (result) digests.push(result.value);
  }
  return digests;
}

async function names(dir = DATA_DIR): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse();
  } catch {
    return [];
  }
}

/** Newest first; the public site only needs a bounded window. */
export async function readArchive(limit = 400, dir = DATA_DIR): Promise<Digest[]> {
  return readDays((await names(dir)).slice(0, limit), dir);
}

/** Dedupe uses the complete append-only history so old stories never resurface. */
export async function readArchiveAll(dir = DATA_DIR): Promise<Digest[]> {
  return readDays(await names(dir), dir);
}

export async function writeDigest(digest: Digest): Promise<string> {
  await mkdir(DATA_DIR, { recursive: true });
  const path = join(DATA_DIR, `${digest.date}.json`);
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(digest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  } catch (err) {
    await unlink(temporary).catch(() => undefined);
    throw err;
  }
  return path;
}
