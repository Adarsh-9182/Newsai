/**
 * The one serverless function. vercel.json rewrites /api/* here, and
 * everything is routed inside handle(), so the API has a single cold start
 * and the same code runs unchanged in the local dev server and the tests.
 */
import { handle } from "../src/server/app.js";
import { storeFromEnv } from "../src/server/store/index.js";

export default {
  async fetch(req: Request): Promise<Response> {
    return handle(req, await storeFromEnv());
  },
};
