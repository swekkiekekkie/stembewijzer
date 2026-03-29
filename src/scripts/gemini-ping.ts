/**
 * Test: Gemini API + key uit .env
 *   npm run gemini:ping
 */

import { createGeminiClient, DEFAULT_GEMINI_MODEL } from "../lib/gemini/client.ts";

async function main(): Promise<void> {
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: "Antwoord met precies één woord: ok",
  });
  const text = response.text?.trim() ?? "";
  console.log(text || "(geen tekst in response)");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
