import test from "node:test";
import assert from "node:assert/strict";
import { summarise } from "./summarize.js";
import { analyseTop } from "./analyse.js";
import { RawItem, Story } from "./types.js";
import { LanguageModel } from "./llm.js";

const item = (id: string): RawItem => ({ id, title: id, source: "Hacker News", url: `https://example.com/${id}`, signal: 1, publishedAt: "2026-10-04T00:00:00Z" });
const model = (text: string): LanguageModel => ({ generate: async () => ({ text, inputTokens: 1, outputTokens: 1 }) });

test("indexed partial summary responses cannot attach another item's summary", async () => {
  const { stories } = await summarise([item("first"), item("second")], model('[{"i":2,"summary":"The second item.","why":"Context.","tags":["agents"]}]'));
  assert.deepEqual(stories.map((s) => [s.id, s.summary]), [["second", "The second item."]]);
});

test("duplicate model indices are ambiguous and are discarded", async () => {
  const { stories } = await summarise([item("first")], model('[{"i":1,"summary":"A"},{"i":1,"summary":"B"}]'));
  assert.equal(stories.length, 0);
});

test("analysis never uses generated summaries as source evidence", async () => {
  const story: Story = { ...item("title-only"), summary: "MODEL_INVENTED_NUMBER_999", why: "", tags: [] };
  let prompt = "";
  const client: LanguageModel = { generate: async (input) => {
    prompt = input.prompt;
    return { text: '{"what":"Only a title.","soWhat":"Unclear.","caveats":"No source description is available.","takeaways":[]}', inputTokens: 1, outputTokens: 1 };
  } };
  await analyseTop([story], 1, client);
  assert.ok(!prompt.includes("MODEL_INVENTED_NUMBER_999"));
  assert.match(prompt, /Only the title is evidence/);
});
