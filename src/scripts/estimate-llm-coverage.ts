/**
 * Eenmalige schatting: max API-calls (gemeente × stelling) en prompt-grootte.
 *   npx tsx src/scripts/estimate-llm-coverage.ts [snapshot-dir]
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { decodeStemwijzerPayload } from "../lib/stembewijzer/decode.ts";
import { normalizeStemwijzerBundle } from "../lib/stembewijzer/normalize.ts";

const DEFAULT = "data/stemwijzer-snapshots/2026-03-25";

function main(): void {
  const root = resolve(process.cwd(), process.argv[2] ?? DEFAULT);
  const files = readdirSync(root).filter((f) => /^GM\d+\.json$/u.test(f));

  let sumPairs = 0;
  let maxStatements = 0;
  let minStatements = Infinity;
  let totalPromptChars = 0;
  let maxPromptChars = 0;
  let totalExplanationsChars = 0;
  let explanationCount = 0;

  const templateOverhead = 280;

  let skipped = 0;
  for (const file of files) {
    const body = readFileSync(resolve(root, file), "utf8");
    let bundle;
    try {
      bundle = normalizeStemwijzerBundle(decodeStemwijzerPayload(body));
    } catch {
      skipped += 1;
      continue;
    }
    const nStmt = bundle.statements.length;
    sumPairs += nStmt;
    maxStatements = Math.max(maxStatements, nStmt);
    minStatements = Math.min(minStatements, nStmt);

    for (const st of bundle.statements) {
      const sk = st.key;
      let chars = st.title.length + templateOverhead;
      for (const p of bundle.parties) {
        if (p.positions[sk] === undefined) continue;
        const ex = p.explanations[sk] ?? "";
        chars += p.shortName.length + ex.length + 24;
        totalExplanationsChars += ex.length;
        explanationCount += 1;
      }
      totalPromptChars += chars;
      maxPromptChars = Math.max(maxPromptChars, chars);
    }
  }

  const n = files.length;
  if (sumPairs === 0 || explanationCount === 0) {
    console.error("Geen data (sumPairs=0 of geen uitleg-paren). skipped_files:", skipped);
    process.exit(1);
    return;
  }

  const avgPromptChars = totalPromptChars / sumPairs;
  const avgExPerPair = totalExplanationsChars / explanationCount;

  const lo = 3.5;
  const hi = 4.5;
  const tokAvgLo = avgPromptChars / hi;
  const tokAvgHi = avgPromptChars / lo;
  const totInLo = totalPromptChars / hi;
  const totInHi = totalPromptChars / lo;

  console.log(
    JSON.stringify(
      {
        snapshotDir: root,
        gemeenten: n,
        som_gemeente_stelling: sumPairs,
        max_api_calls_prefill: sumPairs,
        stellingen_per_gemeente: { min: minStatements, max: maxStatements, gem: sumPairs / n },
        prompt_chars: { gem_per_call: Math.round(avgPromptChars), max_per_call: maxPromptChars },
        uitleg_chars_gem_per_party_stelling: Math.round(avgExPerPair),
        party_stelling_uitleg_pairs: explanationCount,
        decode_skipped_files: skipped,
      },
      null,
      2,
    ),
  );

  console.log(
    `\nSchatting input-tokens per call (prompt ~NL/JSON; chars/${lo}–${hi} ≈ tokens): ${Math.round(tokAvgLo)} – ${Math.round(tokAvgHi)}`,
  );
  console.log(
    `Totaal input-tokens (alle ${sumPairs} calls, alleen prompts, zelfde bandbreedte): ${Math.round(totInLo).toLocaleString("nl-NL")} – ${Math.round(totInHi).toLocaleString("nl-NL")}`,
  );
  console.log(
    `\nLet op: output-tokens (JSON-antwoord) zit hier niet bij; + instructie-template en evt. system prompt.`,
  );
}

main();
