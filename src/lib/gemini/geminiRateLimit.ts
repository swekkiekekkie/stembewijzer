import { ApiError } from "@google/genai";

/** 429 + quota (RESOURCE_EXHAUSTED) — coalitie-analyse valt dan terug op gemini-2.5-flash. */
export function isGeminiRateLimitError(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 429) return true;
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (s === 429) return true;
  }
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  if (/RESOURCE_EXHAUSTED/i.test(msg)) return true;
  return false;
}
