/**
 * Controleert dat elke partij per stelling waarvoor een positie bestaat, een niet-lege
 * toelichting heeft na decode + normalize (zelfde pad als de app).
 *
 *   npm run data:validate-explanations -- [snapshot-dir] [--participating-only]
 *
 * Standaard: data/stemwijzer-snapshots/2026-03-25
 * --participating-only: alleen partijen met participates=true (minder ruis door lijsten
 *   zonder echte StemWijzer-deelname maar wel lege velden).
 * Exitcode 1 bij ontbrekende of lege (alleen whitespace) uitleg.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { decodeStemwijzerPayload } from "../lib/stembewijzer/decode.ts";
import { normalizeStemwijzerBundle } from "../lib/stembewijzer/normalize.ts";
import type { StatementKey } from "../lib/stembewijzer/domain.ts";

const DEFAULT_DIR = "data/stemwijzer-snapshots/2026-03-25";

function parseArgs(argv: string[]): { dir: string; participatingOnly: boolean } {
  let participatingOnly = false;
  const rest: string[] = [];
  for (const a of argv) {
    if (a === "--participating-only") participatingOnly = true;
    else rest.push(a);
  }
  return { dir: rest[0] ?? DEFAULT_DIR, participatingOnly };
}

function main(): void {
  const { dir: dirArg, participatingOnly } = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd(), dirArg);

  let files: string[];
  try {
    files = readdirSync(root).filter((f) => /^GM\d+\.json$/u.test(f));
  } catch (e) {
    console.error(`Kan map niet lezen: ${root}`, e);
    process.exit(1);
    return;
  }

  if (files.length === 0) {
    console.error(`Geen GM*.json gevonden in ${root}`);
    process.exit(1);
    return;
  }

  let totalProblems = 0;
  const byFile: { file: string; rows: string[] }[] = [];

  for (const file of files.sort()) {
    const path = resolve(root, file);
    const body = readFileSync(path, "utf8");
    let rows: string[];
    try {
      const raw = decodeStemwijzerPayload(body);
      const bundle = normalizeStemwijzerBundle(raw);
      rows = [];
      for (const party of bundle.parties) {
        if (participatingOnly && !party.participates) continue;
        const keys = Object.keys(party.positions) as StatementKey[];
        for (const sk of keys) {
          const rawEx = party.explanations[sk];
          const t = typeof rawEx === "string" ? rawEx.trim() : "";
          if (t.length === 0) {
            rows.push(`  ${party.shortName} @ ${sk}: lege of ontbrekende uitleg`);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rows = [`  (decode/normalize faalde: ${msg})`];
    }

    if (rows.length > 0) {
      totalProblems += rows.length;
      byFile.push({ file, rows });
    }
  }

  if (totalProblems === 0) {
    const scope = participatingOnly ? " (alleen participates)" : "";
    console.log(`OK — ${files.length} bestanden${scope}, alle partij-stelling uitleg ingevuld.`);
    return;
  }

  console.error(`FAIL — ${totalProblems} lege uitleg-regels in ${byFile.length} bestand(en):\n`);
  for (const { file, rows } of byFile) {
    console.error(`${file} (${rows.length})`);
    for (const r of rows) console.error(r);
    console.error("");
  }
  process.exit(1);
}

main();
