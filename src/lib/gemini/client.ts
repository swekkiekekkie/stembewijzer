import { GoogleGenAI } from "@google/genai";

/**
 * Standaardmodel voor scripts; pas aan naar wat ai.google.dev voor jouw key aanbiedt.
 * @see https://ai.google.dev/gemini-api/docs
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** Eerste keuze voor coalitie-analyse; bij 429 valt de PoC-api terug op {@link DEFAULT_GEMINI_MODEL}. */
export const GEMINI_COALITION_PRIMARY_MODEL = "gemini-3-flash-preview";

/** Zet `GEMINI_API_KEY` in `.env` (lokaal); laad met `tsx --env-file=.env`. */
export function requireGeminiApiKey(): string {
  const k = process.env.GEMINI_API_KEY?.trim();
  if (!k) {
    throw new Error(
      "GEMINI_API_KEY ontbreekt. Zet de key in .env en run scripts met: tsx --env-file=.env …",
    );
  }
  return k;
}

/** Alleen gebruiken vanuit Node-scripts — niet bundlen naar de browser (key lekt). */
export function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireGeminiApiKey() });
}
