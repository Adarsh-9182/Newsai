/**
 * The one serverless function. vercel.json rewrites /api/* here and every
 * route is dispatched inside handle(), so the API has a single cold start.
 *
 * Plain JavaScript importing the compiled output, on purpose. This file used
 * to be TypeScript importing `../src/server/node.js` — a `.js` specifier that
 * only means something if the platform's own TypeScript pipeline maps it back
 * to the `.ts` file, which is a behaviour of Vercel's builder rather than of
 * anything this repo controls, and could only be tested by deploying. The
 * build command already runs `tsc` first, so `dist/` exists by the time this
 * function is bundled; importing that is ordinary Node ESM resolution and is
 * the same shape the other Vercel deployment on this account already runs.
 *
 * The Node runtime (Vercel's default) is required rather than preferred: the
 * Postgres driver opens a TCP connection, which the edge runtime cannot do.
 * The (req, res) signature is Vercel's Node contract; dist/server/node.js turns
 * it into the Request/Response the app is written against, and the local
 * preview server uses that same adapter.
 */
import { nodeHandler } from "../dist/server/node.js";
import { storeFromEnv } from "../dist/server/store/index.js";

/** @param {import("node:http").IncomingMessage} req @param {import("node:http").ServerResponse} res */
export default async function handler(req, res) {
  await nodeHandler(req, res, await storeFromEnv());
}
