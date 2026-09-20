/**
 * See the site without an API key.
 *
 *   npm run preview      → http://localhost:3000
 *
 * Writes clearly fictional sample stories to .preview-data/ (git-ignored),
 * renders the real site from them, and serves public/ locally together with
 * the real /api handler on an in-memory database — so sign-up, sign-in and
 * saved stories all work with no setup, and vanish when you stop the server.
 * It applies the same security headers as vercel.json, so a script the
 * Content Security Policy would block in production fails here too. It never
 * touches data/, which is the committed archive that gets published. The
 * names below are invented on purpose so a preview page can never be
 * mistaken for a report about a real project.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { extname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dir = join(root, ".preview-data");
mkdirSync(dir, { recursive: true });

const mk = (n, title, source, signal, summary, why, tags, analysis) => ({
  id: `sample:${n}`, title, url: `https://example.com/${n}`, source, signal, publishedAt: "2026-09-20T02:00:00Z",
  summary, why, tags, slug: `sample-${n}`, ...(analysis ? { analysis } : {}),
});
const A = (what, soWhat, caveats, takeaways) => ({ what, soWhat, caveats, takeaways });

const lorem = "This is sample text so the layout can be judged. It is not a report about a real project.";
const day = (date, stories) => ({ date, generatedAt: `${date}T01:40:00Z`, stories });

const days = [
  day("2026-09-20", [
    mk(1, "Sample: an open framework for long-lived agent teams", "GitHub", 3766,
      "A fictional repository coordinating several agents around shared state, with human checkpoints.",
      "Shared state between agents is where multi-agent systems quietly break.", ["agents", "tools"],
      A(lorem, "If you build with more than one agent, the checkpoint pattern is the part worth borrowing.",
        "A sample caveat: the description gives no benchmark, failure rate or comparison. Stars measure interest, not reliability.",
        ["Read how checkpoints are declared before adopting", "Check star growth again in a month"])),
    mk(2, "Sample: why AI-generated posters look bad", "Hacker News", 1681,
      "A fictional essay arguing poor output comes from skipping the brief, not from the model.",
      "Output quality tracks input specificity.", ["models"]),
    mk(3, "Sample: measuring verified tool use in financial agents", "arXiv", 0,
      "A fictional paper testing whether forcing agents to cite tool outputs reduces made-up figures.",
      "Directly relevant to anything that quotes numbers.", ["research", "agents"],
      A(lorem, "It supports making a figure's provenance structural rather than a prompt request.",
        "A sample caveat: the abstract does not give the evaluation size, the models tested or how realistic the questions are.",
        ["Log the tool call behind every figure", "Treat prompt-only carefulness as unproven"])),
    mk(4, "Sample: an essay on scraping and the creative commons", "Hacker News", 189,
      "A fictional essay on how large-scale scraping changes incentives for publishing openly.",
      "Policy pressure on training data is likely to rise.", ["policy"]),
    mk(5, "Sample: new tooling for building agents", "OpenAI", 60,
      "A fictional lab post describing updates to agent-building interfaces.",
      "Routine unless you depend on their SDK.", ["agents", "tools"]),
    mk(6, "Sample: a memory layer for long agent loops", "GitHub", 959,
      "A fictional library that stores tool results outside the context window.",
      "Context limits are the usual wall for long loops.", ["agents", "infra"]),
    mk(7, "Sample: sample-efficient training for small models", "arXiv", 0,
      "A fictional paper reaching a target score with fewer rollouts.",
      "Cheaper post-training matters if you fine-tune.", ["research", "models"]),
  ]),
  day("2026-09-19", [
    mk(8, "Sample: a compact image model for generation and editing", "Hacker News", 74,
      "A fictional release of a small image model.", "Smaller models are easier to self-host.", ["models"]),
    mk(9, "Sample: a library that re-checks agent claims against logs", "GitHub", 1232,
      "A fictional checker that runs between the model and the user.", "A check between model and user.", ["agents", "tools"]),
  ]),
];
for (const d of days) writeFileSync(join(dir, `${d.date}.json`), JSON.stringify(d, null, 2));

const env = { ...process.env, NEWSAI_DATA_DIR: dir, NEWSAI_SITE_URL: `http://localhost:${process.env.PORT ?? 3000}` };
const built = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
if (built.status !== 0) { console.error("build failed — run `npm run typecheck`"); process.exit(1); }
const r = spawnSync("node", ["dist/render.js"], { cwd: root, env, stdio: "inherit" });
if (r.status !== 0) process.exit(1);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".xml": "application/xml", ".txt": "text/plain",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json",
};
const pub = join(root, "public");

// Same headers production sends, read from vercel.json so they cannot drift.
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const secHeaders = Object.fromEntries(
  vercel.headers.flatMap((h) => h.source === "/(.*)" ? h.headers.map((x) => [x.key, x.value]) : []),
);

const { handle } = await import(join(root, "dist/server/app.js"));
const { memoryStore } = await import(join(root, "dist/server/store/memory.js"));
const store = memoryStore();

const PORT = Number(process.env.PORT ?? 3000);
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined }), store);
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    const cookie = r.headers.getSetCookie?.();
    if (cookie?.length) headers["set-cookie"] = cookie;
    res.writeHead(r.status, headers).end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(pub, p);
  if (!file.startsWith(pub)) { res.writeHead(403).end(); return; }
  if (p.endsWith("/") || !extname(p)) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404, { ...secHeaders, "content-type": TYPES[".html"] }).end(readFileSync(join(pub, "404.html"))); return; }
  res.writeHead(200, { ...secHeaders, "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
}).listen(PORT, () => console.log(`\n  preview → http://localhost:${PORT}   (ctrl+c to stop)\n  sample data + in-memory accounts — nothing here is real\n`));
