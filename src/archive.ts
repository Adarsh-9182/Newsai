/**
 * The archive is the database.
 *
 * One JSON file per day in data/, committed to the repository. There is no
 * database because there is no state a database would hold: the digests are
 * append-only, a few kilobytes each, and read whole. Committing them means
 * the history of the site is the history of the repo, hosting costs nothing,
 * and a bad run is reverted with git rather than repaired with SQL.
 */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Digest } from "./types.js";

/**
 * Where the digests live. Overridable so a preview or a test can point at a
 * scratch directory and never risk writing sample data into the real archive,
 * which is committed and published.
 */
export const DATA_DIR = (process.env.NEWSAI_DATA_DIR ?? new URL("../data/", import.meta.url).pathname).replace(/\/?$/, "/");

export const today = (): string => new Date().toISOString().slice(0, 10);

/** Newest first. `limit` bounds the read — dedupe only needs recent days. */
export async function readArchive(limit = 400): Promise<Digest[]> {
  let names: string[];
  try {
    names = await readdir(DATA_DIR);
  } catch {
    return [];
  }
  const days = names.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse().slice(0, limit);

  const digests: Digest[] = [];
  for (const name of days) {
    try {
      digests.push(JSON.parse(await readFile(join(DATA_DIR, name), "utf8")) as Digest);
    } catch (err) {
      // A corrupt day is skipped, never fatal: it would otherwise block every
      // future run until someone noticed.
      console.warn(`  skipping unreadable ${name}: ${err}`);
    }
  }
  return digests;
}

export async function writeDigest(digest: Digest): Promise<string> {
  await mkdir(DATA_DIR, { recursive: true });
  const path = join(DATA_DIR, `${digest.date}.json`);
  await writeFile(path, `${JSON.stringify(digest, null, 2)}\n`, "utf8");
  return path;
}
