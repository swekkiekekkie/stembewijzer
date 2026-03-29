/**
 * Bouw landelijke woordtellingen over alle StemWijzer-toelichtingen.
 *
 * Schrijft naar `data/processed/explanation-word-stats.json`.
 *
 *   npm run data:explanation-word-stats
 *   npm run data:explanation-word-stats -- --snapshot-dir data/stemwijzer-snapshots/2026-03-25
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  BUILT_IN_UNINTERESTING_WORDS,
  EXPLANATION_WORD_MIN_LENGTH,
  accumulateTextsIntoAggregate,
  createExplanationWordAggregateBuilder,
  finalizeExplanationWordAggregate,
  type ExplanationWordStatsFile,
} from "../lib/explanationWords.ts";
import { decodeStemwijzerPayload } from "../lib/stembewijzer/decode.ts";
import { normalizeStemwijzerBundle, partyKeyFromName } from "../lib/stembewijzer/normalize.ts";

function argValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function latestSnapshotDir(projectRoot: string): string {
  const base = resolve(projectRoot, "data/stemwijzer-snapshots");
  const names = readdirSync(base).filter((name) => {
    try {
      return statSync(resolve(base, name)).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(name);
    } catch {
      return false;
    }
  });
  names.sort((a, b) => b.localeCompare(a));
  const picked = names[0];
  if (!picked) throw new Error(`Geen snapshotmap gevonden in ${base}`);
  return resolve(base, picked);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const projectRoot = process.cwd();
  const snapshotDir =
    argValue(argv, "--snapshot-dir")?.trim() ||
    process.env.STEMWIJZER_SNAPSHOT_DIR?.trim() ||
    latestSnapshotDir(projectRoot);

  const files = readdirSync(snapshotDir).filter((name) => /^GM\d+\.json$/i.test(name));

  const nationwideAll = createExplanationWordAggregateBuilder("nederland", "Alle partijen");
  const byPartyKey = new Map<string, ReturnType<typeof createExplanationWordAggregateBuilder>>();

  let explanationTotal = 0;
  let partyEntries = 0;

  for (const file of files) {
    const gmCode = file.replace(/\.json$/i, "");
    const rawBody = readFileSync(resolve(snapshotDir, file), "utf8");
    const bundle = normalizeStemwijzerBundle(decodeStemwijzerPayload(rawBody));

    for (const party of bundle.parties) {
      const texts = Object.values(party.explanations)
        .map((value) => value?.trim() ?? "")
        .filter((value) => value.length > 0);
      if (texts.length === 0) continue;

      explanationTotal += texts.length;
      partyEntries += 1;

      accumulateTextsIntoAggregate(nationwideAll, texts, gmCode, 1);

      const partyKey = partyKeyFromName(party.shortName);
      let aggregate = byPartyKey.get(partyKey);
      if (!aggregate) {
        aggregate = createExplanationWordAggregateBuilder(partyKey, party.shortName);
        byPartyKey.set(partyKey, aggregate);
      }
      accumulateTextsIntoAggregate(aggregate, texts, gmCode, 1);
    }
  }

  const out: ExplanationWordStatsFile = {
    generatedAt: new Date().toISOString(),
    snapshotDir,
    defaults: {
      minWordLength: EXPLANATION_WORD_MIN_LENGTH,
      builtInUninterestingWords: BUILT_IN_UNINTERESTING_WORDS,
    },
    totals: {
      municipalities: files.length,
      partyEntries,
      explanations: explanationTotal,
      uniquePartyKeys: byPartyKey.size,
    },
    nationwideAll: finalizeExplanationWordAggregate(nationwideAll),
    nationwideByPartyKey: [...byPartyKey.values()]
      .map((aggregate) => finalizeExplanationWordAggregate(aggregate))
      .sort((left, right) => left.label.localeCompare(right.label, "nl")),
  };

  const outDir = resolve(projectRoot, "data/processed");
  const outFile = resolve(outDir, "explanation-word-stats.json");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");

  console.error("Geschreven:", outFile);
  console.error(JSON.stringify(out.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
