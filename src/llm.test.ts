import test from "node:test";
import assert from "node:assert/strict";
import { gemini } from "./llm.js";
import { runPipeline } from "./pipeline.js";
import { fetchSource } from "./sources/http.js";

test("Gemini sends a JSON-only request and returns text and usage", async () => {
  const originalFetch = globalThis.fetch;
  let sentUrl = "";
  let sentHeaders: Headers | undefined;
  let sentBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input, init) => {
    sentUrl = String(input);
    sentHeaders = new Headers(init?.headers);
    sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "[{\"summary\":\"A factual summary.\"}]" }] } }],
      usageMetadata: { promptTokenCount: 31, candidatesTokenCount: 12 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await gemini("test-key").generate({
      model: "gemini-3.1-flash-lite", system: "Return JSON.", prompt: "Public story text.", maxTokens: 500,
    });
    assert.equal(new URL(sentUrl).search, "", "API key must not be placed in the URL");
    assert.equal(sentHeaders?.get("x-goog-api-key"), "test-key");
    assert.deepEqual((sentBody?.generationConfig as Record<string, unknown>).responseMimeType, "application/json");
    assert.equal(result.text, "[{\"summary\":\"A factual summary.\"}]");
    assert.equal(result.inputTokens, 31);
    assert.equal(result.outputTokens, 12);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini retries a transient provider failure", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return new Response("busy", { status: 503 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await gemini("test-key").generate({ model: "test-model", system: "json", prompt: "test", maxTokens: 10 });
    assert.equal(result.text, "{}");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("source fetches have a timeout signal", async () => {
  const originalFetch = globalThis.fetch;
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input, init) => {
    signal = init?.signal;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  try {
    await fetchSource("https://example.test/feed");
    assert.ok(signal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing model credentials stop the pipeline before collection", async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(runPipeline(), /GEMINI_API_KEY is required/);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
