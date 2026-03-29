/**
 * Per gemeente: StemWijzer-partij (`shortName`) vs NOS VoteFlow (`partij.short_name`).
 *
 *   npm run data:compare-parties
 *   npm run data:compare-parties -- --stemwijzer-dir data/stemwijzer-snapshots/2026-03-25 --nos-dir data/nos-voteflow-snapshots/2026-03-25
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { toGmCode } from "../lib/stembewijzer/cbs";
import { decodeStemwijzerPayload } from "../lib/stembewijzer/decode";
import { normalizeStemwijzerBundle } from "../lib/stembewijzer/normalize";
import type { NosVoteFlowGemeenteJson } from "../lib/nosVoteFlow/raw";
import {
  compareStemwijzerWithNosGemeente,
  type StemwijzerNosCompareSummary,
} from "../lib/partyCompare/stemwijzerNos";
import {
  buildLikelyPartyMapping,
  LIKELY_STRONG_SCORE,
  type LikelyPartyMappingResult,
} from "../lib/partyCompare/likelyPartyMapping";
import type { StemwijzerNosPartyDiff } from "../lib/partyCompare/stemwijzerNos";

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

const ISO_DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

function latestSubdir(projectRoot: string, baseRelative: string): string {
  const base = resolve(projectRoot, baseRelative);
  const names = readdirSync(base).filter((n) => {
    try {
      return statSync(resolve(base, n)).isDirectory();
    } catch {
      return false;
    }
  });
  const dated = names.filter((n) => ISO_DATE_DIR.test(n));
  const pool = dated.length > 0 ? dated : names;
  pool.sort((a, b) => b.localeCompare(a));
  const pick = pool[0];
  if (!pick) throw new Error(`Geen map in ${base}`);
  return resolve(base, pick);
}

function tsvCell(s: string): string {
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

interface MappingEdgeDump {
  gmCode: string;
  gCode: string;
  gemeenteStemwijzer: string | null;
  gemeenteNos: string | null;
  stemwijzerShortName: string;
  stemwijzerFullName: string;
  nosShortName: string;
  nosFullName: string;
  score: number;
}

function writeMappingDumps(
  outDir: string,
  compareRows: readonly StemwijzerNosPartyDiff[],
  mappingRows: readonly LikelyPartyMappingResult[],
): { strongJsonl: string; weakJsonl: string; strongTsv: string; weakTsv: string; unmatchedJsonl: string } {
  if (compareRows.length !== mappingRows.length) {
    throw new Error("compareRows en mappingRows moeten even lang zijn");
  }

  const strong: MappingEdgeDump[] = [];
  const weak: MappingEdgeDump[] = [];
  const unmatchedLines: string[] = [];

  for (let idx = 0; idx < mappingRows.length; idx++) {
    const cr = compareRows[idx]!;
    const m = mappingRows[idx]!;

    if (m.unmatchedStemwijzer.length > 0 || m.unmatchedNos.length > 0) {
      unmatchedLines.push(
        JSON.stringify({
          gmCode: m.gmCode,
          gCode: cr.gCode,
          gemeenteStemwijzer: cr.gemeenteNaamStemwijzer,
          gemeenteNos: cr.gemeenteNaamNos,
          unmatchedStemwijzer: m.unmatchedStemwijzer,
          unmatchedNos: m.unmatchedNos,
        }),
      );
    }

    for (const e of m.edges) {
      const row: MappingEdgeDump = {
        gmCode: m.gmCode,
        gCode: cr.gCode,
        gemeenteStemwijzer: cr.gemeenteNaamStemwijzer,
        gemeenteNos: cr.gemeenteNaamNos,
        stemwijzerShortName: e.stemwijzerShortName,
        stemwijzerFullName: e.stemwijzerFullName,
        nosShortName: e.nosShortName,
        nosFullName: e.nosFullName,
        score: e.score,
      };
      if (e.score >= LIKELY_STRONG_SCORE) strong.push(row);
      else weak.push(row);
    }
  }

  const strongJsonl = resolve(outDir, "party-mapping-strong.jsonl");
  const weakJsonl = resolve(outDir, "party-mapping-weak.jsonl");
  const unmatchedJsonl = resolve(outDir, "party-mapping-unmatched.jsonl");
  writeFileSync(strongJsonl, strong.map((r) => JSON.stringify(r)).join("\n") + (strong.length ? "\n" : ""), "utf8");
  writeFileSync(weakJsonl, weak.map((r) => JSON.stringify(r)).join("\n") + (weak.length ? "\n" : ""), "utf8");
  writeFileSync(unmatchedJsonl, unmatchedLines.join("\n") + (unmatchedLines.length ? "\n" : ""), "utf8");

  const header =
    "gmCode\tgCode\tgemeenteStemwijzer\tgemeenteNos\tstemwijzerShort\tstemwijzerFull\tnosShort\tnosFull\tscore\n";
  const strongTsv = resolve(outDir, "party-mapping-strong.tsv");
  const weakTsv = resolve(outDir, "party-mapping-weak.tsv");
  const tsvRow = (r: MappingEdgeDump) =>
    [
      tsvCell(r.gmCode),
      tsvCell(r.gCode),
      tsvCell(r.gemeenteStemwijzer ?? ""),
      tsvCell(r.gemeenteNos ?? ""),
      tsvCell(r.stemwijzerShortName),
      tsvCell(r.stemwijzerFullName),
      tsvCell(r.nosShortName),
      tsvCell(r.nosFullName),
      String(r.score),
    ].join("\t") + "\n";

  writeFileSync(strongTsv, header + strong.map(tsvRow).join(""), "utf8");
  writeFileSync(weakTsv, header + weak.map(tsvRow).join(""), "utf8");

  return { strongJsonl, weakJsonl, strongTsv, weakTsv, unmatchedJsonl };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const projectRoot = process.cwd();
  const stemwijzerDir =
    argValue(argv, "--stemwijzer-dir")?.trim() ||
    latestSubdir(projectRoot, "data/stemwijzer-snapshots");
  const nosDir =
    argValue(argv, "--nos-dir")?.trim() ||
    latestSubdir(projectRoot, "data/nos-voteflow-snapshots");

  const nosFiles = readdirSync(nosDir).filter((f) => /^G\d{4}\.json$/i.test(f));
  nosFiles.sort((a, b) => a.localeCompare(b));

  const rows: StemwijzerNosCompareSummary["rows"] = [];
  const mappingRows: LikelyPartyMappingResult[] = [];
  const overgeslagen: StemwijzerNosCompareSummary["overgeslagen"] = [];

  for (const file of nosFiles) {
    const gCode = file.replace(/\.json$/i, "");
    let gmCode: string;
    try {
      gmCode = toGmCode(gCode);
    } catch {
      overgeslagen.push({ gmCode: gCode, reden: "ongeldige bestandsnaam" });
      continue;
    }

    const nosPath = resolve(nosDir, file);
    const swPath = resolve(stemwijzerDir, `${gmCode}.json`);
    let nosRaw: NosVoteFlowGemeenteJson;
    try {
      nosRaw = JSON.parse(readFileSync(nosPath, "utf8")) as NosVoteFlowGemeenteJson;
    } catch (e) {
      overgeslagen.push({
        gmCode,
        reden: `NOS JSON: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }

    let swBody: string;
    try {
      swBody = readFileSync(swPath, "utf8");
    } catch {
      overgeslagen.push({ gmCode, reden: "geen StemWijzer-snapshot" });
      continue;
    }

    try {
      const bundle = normalizeStemwijzerBundle(decodeStemwijzerPayload(swBody));
      rows.push(compareStemwijzerWithNosGemeente(bundle, nosRaw, gmCode));
      mappingRows.push(buildLikelyPartyMapping(bundle.parties, nosRaw.partijen, gmCode));
    } catch (e) {
      overgeslagen.push({
        gmCode,
        reden: `StemWijzer decode: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  const zelfdeAantal = rows.filter((r) => r.countsMatch).length;
  const zelfdeSet = rows.filter((r) => r.setsMatch).length;
  const metVerschil = rows.filter((r) => !r.setsMatch).length;

  let mappingEdgesTotal = 0;
  let mappingStrong = 0;
  let mappingWeak = 0;
  for (const m of mappingRows) {
    mappingEdgesTotal += m.edges.length;
    for (const e of m.edges) {
      if (e.score >= LIKELY_STRONG_SCORE) mappingStrong++;
      else mappingWeak++;
    }
  }

  const summary: StemwijzerNosCompareSummary = {
    generatedAt: new Date().toISOString(),
    stemwijzerSnapshotDir: stemwijzerDir,
    nosSnapshotDir: nosDir,
    gemeentenGeprobeerd: nosFiles.length,
    gemeentenMetStemwijzerEnNos: rows.length,
    zelfdeAantal,
    zelfdeSet,
    metVerschil,
    overgeslagen,
    rows,
  };

  const pairKey = (sw: string, nos: string) => `${sw}\0${nos}`;
  const pairFreq = new Map<string, { stemwijzerShortName: string; nosShortName: string; count: number }>();
  for (const m of mappingRows) {
    for (const e of m.edges) {
      const k = pairKey(e.stemwijzerShortName, e.nosShortName);
      const cur = pairFreq.get(k);
      if (cur) cur.count++;
      else
        pairFreq.set(k, {
          stemwijzerShortName: e.stemwijzerShortName,
          nosShortName: e.nosShortName,
          count: 1,
        });
    }
  }
  const pairFrequencyDesc = [...pairFreq.values()].sort((a, b) => b.count - a.count);

  const mappingSummary = {
    generatedAt: summary.generatedAt,
    stemwijzerSnapshotDir: stemwijzerDir,
    nosSnapshotDir: nosDir,
    gemeenten: mappingRows.length,
    /** Greedy kanten met score ≥ LIKELY_STRONG_SCORE (default 0.85). */
    kantenSterk: mappingStrong,
    kantenZwak: mappingWeak,
    kantenTotaal: mappingEdgesTotal,
    gemiddeldeScorePerGemeente:
      mappingRows.length === 0
        ? null
        : mappingRows.reduce((s, m) => s + (m.meanScoreMatched ?? 0), 0) / mappingRows.length,
    /** Hoe vaak komt hetzelfde (SW short, NOS short)-paar voor over gemeenten (voor alias-tabel). */
    pairFrequencyDesc,
    rows: mappingRows,
  };

  const outDir = resolve(projectRoot, "data/processed");
  mkdirSync(outDir, { recursive: true });
  const dumps = writeMappingDumps(outDir, rows, mappingRows);

  const outFile = resolve(outDir, "party-compare-stemwijzer-nos.json");
  writeFileSync(outFile, JSON.stringify(summary, null, 2), "utf8");
  const mapFile = resolve(outDir, "party-likely-mapping.json");
  writeFileSync(mapFile, JSON.stringify(mappingSummary, null, 2), "utf8");

  console.error("Geschreven:", outFile);
  console.error("Geschreven:", mapFile);
  console.error("Geschreven (review):", dumps.strongJsonl, `(${mappingStrong} regels)`);
  console.error("Geschreven (review):", dumps.weakJsonl, `(${mappingWeak} regels)`);
  console.error("Geschreven (review):", dumps.strongTsv);
  console.error("Geschreven (review):", dumps.weakTsv);
  console.error("Geschreven (review):", dumps.unmatchedJsonl);
  console.error(
    JSON.stringify(
      {
        gemeentenMetStemwijzerEnNos: summary.gemeentenMetStemwijzerEnNos,
        zelfdeAantal,
        zelfdeSet,
        metVerschil,
        overgeslagen: overgeslagen.length,
        likelyMapping: {
          kantenSterk: mappingStrong,
          kantenZwak: mappingWeak,
          gemiddeldeMeanScorePerGemeente: mappingSummary.gemiddeldeScorePerGemeente,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
