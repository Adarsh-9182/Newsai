/**
 * The one serverless function. vercel.json rewrites /api/* here and every
 * route is dispatched inside handle(), so the API has a single cold start.
 *
 * The Node runtime (Vercel's default) is required rather than preferred: the
 * Postgres driver opens a TCP connection, which the edge runtime cannot do.
 * The (req, res) signature is Vercel's Node contract; src/server/node.ts turns
 * it into the Request/Response the app is written against, and the local
 * preview server uses that same adapter.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { nodeHandler } from "../src/server/node.js";
import { storeFromEnv } from "../src/server/store/index.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await nodeHandler(req, res, await storeFromEnv());
}
