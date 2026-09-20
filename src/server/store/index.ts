/**
 * Picks the Store from the environment.
 *
 *   DATABASE_URL set          → Postgres (Neon or Supabase; same code)
 *   unset, running locally    → in-memory, so `npm run dev` works with no setup
 *   unset, running on Vercel  → null, and the API answers 503
 *
 * The last row is the one that matters. Falling back to memory in production
 * would appear to work — people could sign up — and then quietly lose every
 * account on the next cold start. A loud 503 is the safer failure.
 */

import { Store } from "../types.js";
import { memoryStore } from "./memory.js";
import { postgresStore, migrate, Db } from "./postgres.js";

let cached: Promise<Store | null> | undefined;

async function connect(url: string): Promise<Store> {
  const { default: postgres } = await import("postgres");
  // Neon and Supabase both require TLS; Supabase's pooler (port 6543) also
  // needs prepared statements off, which is harmless everywhere else.
  const sql = postgres(url, { ssl: "require", prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10 });
  const db: Db = {
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as T[],
  };
  await migrate(db);
  return postgresStore(db);
}

export function storeFromEnv(): Promise<Store | null> {
  cached ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (url) return connect(url);
    if (process.env.VERCEL) return null;
    return memoryStore();
  })().catch((err) => {
    // A failed connect must not be cached: the next request should try again,
    // not replay the same rejection until the function is recycled.
    cached = undefined;
    throw err;
  });
  return cached;
}
