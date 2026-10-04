/** Recorded alongside editions so changes to models and instructions are auditable. */
export const SUMMARY_PROMPT_VERSION = "summary-v2-indexed-source-only";
export const ANALYSIS_PROMPT_VERSION = "analysis-v2-source-only";
export const summaryModel = (): string => process.env.NEWSAI_SUMMARY_MODEL ?? "gemini-3.1-flash-lite";
export const analysisModel = (): string => process.env.NEWSAI_ANALYSIS_MODEL ?? "gemini-3.1-flash-lite";
