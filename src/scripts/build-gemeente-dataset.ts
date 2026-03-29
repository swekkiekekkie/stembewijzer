/**
 * Decode alle `GM*.json` snapshots en leg ze naast `data/uitslagen.json` (zelfde CBS-code).
 *
 *   npm run data:gemeente-dataset
 *   npm run data:gemeente-dataset -- --snapshot-dir data/stemwijzer-snapshots/2026-03-25
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import { extractGemeenteDigits } from "../lib/stembewijzer/cbs.ts";
import { decodeStemwijzerPayload } from "../lib/stembewijzer/decode.ts";
import type {
  GemeenteDatasetFile,
  GemeenteDatasetRow,
} from "../lib/stembewijzer/gemeenteDataset.ts";
import type { GemeenteJoinValidation } from "../lib/stembewijzer/validateJoin.ts";
import { normalizeStemwijzerBundle } from "../lib/stembewijzer/normalize.ts";
import { computeGemeentePartyAlignment } from "../lib/stembewijzer/partyAlignment.ts";
import { validateStemwijzerUitslagenJoin } from "../lib/stembewijzer/validateJoin.ts";
import type { UitslagenCleanBundle } from "../lib/uitslagen/domain";
import {
  normalizeUitslagenWire,
  parseUitslagenJson,
} from "../lib/uitslagen";

import type { FetchLogRow } from "./stemwijzer-snapshot/types.ts";

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function loadJsonl(path: string): FetchLogRow[] {
  const text = readFileSync(path, "utf8");
  const rows: FetchLogRow[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    rows.push(JSON.parse(t) as FetchLogRow);
  }
  return rows;
}

function latestSnapshotDir(projectRoot: string): string {
  const base = resolve(projectRoot, "data/stemwijzer-snapshots");
  const names = readdirSync(base).filter((n) => {
    try {
      return statSync(resolve(base, n)).isDirectory();
    } catch {
      return false;
    }
  });
  names.sort((a, b) => b.localeCompare(a));
  const pick = names[0];
  if (!pick) throw new Error(`Geen mappen in ${base}`);
  return resolve(base, pick);
}

function loadCleanUitslagen(projectRoot: string): UitslagenCleanBundle {
  const path = resolve(projectRoot, "data/uitslagen.json");
  const wire = parseUitslagenJson(readFileSync(path, "utf8"));
  return normalizeUitslagenWire(wire);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const projectRoot = process.cwd();
  const snapshotDir =
    argValue(argv, "--snapshot-dir")?.trim() ||
    process.env.STEMWIJZER_SNAPSHOT_DIR?.trim() ||
    latestSnapshotDir(projectRoot);

  const logPath = resolve(snapshotDir, "fetch-log.jsonl");
  const logRows = loadJsonl(logPath);
  const uitslagenClean = loadCleanUitslagen(projectRoot);

  const rows: GemeenteDatasetRow[] = [];
  let decodedOk = 0;
  let decodeFailed = 0;
  const decodeFailedGmCodes: string[] = [];
  let withJson = 0;
  let snapshot404 = 0;
  let withUitslag = 0;

  for (const log of logRows) {
    const d = extractGemeenteDigits(log.gmCode);
    if (!d) continue;

    const uEntry = uitslagenClean.byGemeenteDigits[d] ?? null;
    if (uEntry) withUitslag += 1;

    let stemwijzer = null;
    let decodeError: string | null = null;
    let gemeenteNaamStemwijzer: string | null = null;
    let stemwijzerIds: {
      votematchNumericId: number;
      remoteId: string;
    } | null = null;
    let validation: GemeenteJoinValidation | null = null;
    let partyAlignment = null;

    if (log.status === 200) {
      withJson += 1;
      const rawPath = resolve(snapshotDir, `${log.gmCode}.json`);
      try {
        const body = readFileSync(rawPath, "utf8");
        const raw = decodeStemwijzerPayload(body);
        stemwijzer = normalizeStemwijzerBundle(raw);
        gemeenteNaamStemwijzer = stemwijzer.meta.label;
        stemwijzerIds = {
          votematchNumericId: stemwijzer.meta.votematchNumericId,
          remoteId: stemwijzer.meta.remoteId,
        };
        validation = validateStemwijzerUitslagenJoin(log.gmCode, stemwijzer, uEntry);
        partyAlignment = computeGemeentePartyAlignment(
          stemwijzer,
          uEntry,
          uitslagenClean,
        );
        decodedOk += 1;
      } catch (e) {
        decodeFailed += 1;
        decodeFailedGmCodes.push(log.gmCode);
        decodeError = e instanceof Error ? e.message : String(e);
      }
    } else if (log.status === 404) {
      snapshot404 += 1;
    }

    rows.push({
      gmCode: log.gmCode,
      gemeenteDigits: d,
      snapshotHttpStatus: log.status,
      snapshotUrl: log.url || null,
      gemeenteNaamUitslagen: uEntry?.gemeenteNaam ?? null,
      gemeenteNaamStemwijzer,
      stemwijzerIds,
      validation,
      partyAlignment,
      uitslag: uEntry,
      stemwijzer,
      decodeError,
    });
  }

  rows.sort((a, b) => a.gmCode.localeCompare(b.gmCode));

  const naamMismatchSamples: GemeenteDatasetFile["validationStats"]["naamMismatchSamples"] =
    [];
  let rowsWithValidation = 0;
  let remoteIdMatchesPath = 0;
  let remoteIdMatchesUitslagenCbs = 0;
  let pathMatchesUitslagenCbs = 0;
  let naamEqualNormalized = 0;
  let naamMismatchLevenshteinGt0 = 0;

  for (const r of rows) {
    const v = r.validation;
    if (!v) continue;
    rowsWithValidation += 1;
    if (v.remoteIdDigitsMatchPathGm) remoteIdMatchesPath += 1;
    if (v.remoteIdDigitsMatchUitslagenCbs) remoteIdMatchesUitslagenCbs += 1;
    if (v.pathDigitsMatchUitslagenCbs) pathMatchesUitslagenCbs += 1;
    if (v.gemeenteNaamEqualNormalized) naamEqualNormalized += 1;
    if (
      v.gemeenteNaamLevenshtein != null &&
      v.gemeenteNaamLevenshtein > 0
    ) {
      naamMismatchLevenshteinGt0 += 1;
      if (naamMismatchSamples.length < 30) {
        naamMismatchSamples.push({
          gmCode: r.gmCode,
          stemwijzer: r.gemeenteNaamStemwijzer ?? "",
          uitslagen: r.gemeenteNaamUitslagen ?? "",
          levenshtein: v.gemeenteNaamLevenshtein,
        });
      }
    }
  }

  let rowsWithPartyAlignment = 0;
  let eersteInStemwijzerCount = 0;
  let tweedeInStemwijzerCount = 0;
  let eersteNotInStemwijzerCount = 0;
  let tweedeNotInStemwijzerCount = 0;
  let rowsWithLocalOnlyParties = 0;
  let rowsWithLongNameMismatch = 0;

  for (const r of rows) {
    const pa = r.partyAlignment;
    if (!pa) continue;
    rowsWithPartyAlignment += 1;
    if (r.uitslag) {
      if (pa.eersteInStemwijzer) eersteInStemwijzerCount += 1;
      else eersteNotInStemwijzerCount += 1;
      if (pa.tweedeInStemwijzer) tweedeInStemwijzerCount += 1;
      else tweedeNotInStemwijzerCount += 1;
    }
    if (pa.stemwijzerShortNamesNotInLandelijk.length > 0) rowsWithLocalOnlyParties += 1;
    const longMismatch = pa.stemwijzerVsLandelijk.some(
      (x) =>
        x.inLandelijkeUitslag &&
        x.longNameMatchesLandelijk === false,
    );
    if (longMismatch) rowsWithLongNameMismatch += 1;
  }

  const out: GemeenteDatasetFile = {
    generatedAt: new Date().toISOString(),
    snapshotDir,
    uitslagenPath: resolve(projectRoot, "data/uitslagen.json"),
    rows,
    stats: {
      rows: rows.length,
      withStemwijzerJson: withJson,
      decodedOk,
      decodeFailed,
      decodeFailedGmCodes,
      withUitslag,
      snapshot404,
    },
    validationStats: {
      rowsWithValidation,
      remoteIdMatchesPath,
      remoteIdMatchesUitslagenCbs,
      pathMatchesUitslagenCbs,
      naamEqualNormalized,
      naamMismatchLevenshteinGt0,
      naamMismatchSamples,
    },
    partyAlignmentStats: {
      rowsWithPartyAlignment,
      eersteInStemwijzerCount,
      tweedeInStemwijzerCount,
      eersteNotInStemwijzerCount,
      tweedeNotInStemwijzerCount,
      rowsWithLocalOnlyParties,
      rowsWithLongNameMismatch,
    },
  };

  const outDir = resolve(projectRoot, "data/processed");
  const outFile = resolve(outDir, "gemeente-dataset.json");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");

  console.error("Geschreven:", outFile);
  console.error(JSON.stringify(out.stats, null, 2));
  console.error(JSON.stringify(out.validationStats, null, 2));
  console.error(JSON.stringify(out.partyAlignmentStats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
