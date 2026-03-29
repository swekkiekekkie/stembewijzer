/**
 * Second pass: read raw snapshot bodies, verify JSON + StemWijzer decode + normalize.
 * Does not perform network requests.
 *
 *   npm run snapshot:validate -- data/stemwijzer-snapshots/2026-03-25
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { decodeStemwijzerPayload } from "../../lib/stembewijzer/decode.ts";
import { normalizeStemwijzerBundle } from "../../lib/stembewijzer/normalize.ts";

import type { FetchLogRow } from "./types.ts";

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

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: npm run snapshot:validate -- <snapshot-dir>");
    process.exit(1);
  }
  const root = resolve(process.cwd(), dir);
  const logPath = resolve(root, "fetch-log.jsonl");
  const rows = loadJsonl(logPath);

  const parseRows: FetchLogRow[] = [];
  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    if (row.status !== 200 || row.error) {
      parseRows.push({ ...row, parseOk: false });
      continue;
    }
    const file = resolve(root, `${row.gmCode}.json`);
    let body: string;
    try {
      body = readFileSync(file, "utf8");
    } catch {
      parseRows.push({ ...row, parseOk: false, error: "snapshot file missing" });
      fail += 1;
      continue;
    }

    try {
      const raw = decodeStemwijzerPayload(body);
      normalizeStemwijzerBundle(raw);
      parseRows.push({ ...row, parseOk: true, error: null });
      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      parseRows.push({ ...row, parseOk: false, error: msg });
      fail += 1;
    }
  }

  const jsonl = parseRows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(resolve(root, "parse-log.jsonl"), jsonl, "utf8");

  console.error(`parse_ok: ${ok}, parse_fail: ${fail}`);
  writeFileSync(
    resolve(root, "parse-summary.json"),
    JSON.stringify({ ok, fail, at: new Date().toISOString() }, null, 2),
    "utf8",
  );

  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
