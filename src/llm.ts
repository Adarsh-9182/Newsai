/** A small provider boundary for the daily editorial pipeline. */
export interface GenerationRequest {
  readonly model: string;
  readonly system: string;
  readonly prompt: string;
  readonly maxTokens: number;
}

export interface GenerationResult {
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface LanguageModel {
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

/** Direct Gemini REST call keeps the scheduled pipeline dependency-light. */
export function gemini(apiKey = process.env.GEMINI_API_KEY): LanguageModel {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to build a digest.");

  return {
    async generate({ model, system, prompt, maxTokens }) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const init: RequestInit = {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0, responseMimeType: "application/json" },
        }),
      };

      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(endpoint, { ...init, signal: AbortSignal.timeout(60_000) });
        } catch (err) {
          if (attempt === 2) throw new Error(`Gemini network request failed: ${err instanceof Error ? err.message : String(err)}`);
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          continue;
        }

        if (response.ok || (response.status !== 429 && response.status < 500) || attempt === 2) break;
        const retryAfter = Number(response.headers.get("retry-after"));
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : 500 * 2 ** attempt));
      }

      if (!response) throw new Error("Gemini request ended without a response.");

      const result = (await response.json().catch(() => ({}))) as GeminiResponse;
      if (!response.ok) {
        // Provider error bodies can echo submitted prompts; keep logs to safe metadata.
        throw new Error(`Gemini request failed (${response.status})${result.error?.message ? `: ${result.error.message}` : ""}`);
      }
      const text = result.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      if (!text) throw new Error("Gemini returned no text candidate.");
      return {
        text,
        inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
      };
    },
  };
}
