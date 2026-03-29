import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { extractGemeenteDigits } from "../../lib/stembewijzer/cbs.ts";
import {
  normalizeUitslagenWire,
  parseUitslagenJson,
} from "../../lib/uitslagen";

/** Build set of 4-digit gemeente keys present in uitslagen (from `Gxxxx`). */
export function loadUitslagenDigitSet(projectRoot: string): Set<string> {
  const path = resolve(projectRoot, "data/uitslagen.json");
  const wire = parseUitslagenJson(readFileSync(path, "utf8"));
  const clean = normalizeUitslagenWire(wire);
  const set = new Set<string>();
  for (const g of clean.gemeentes) {
    const d = extractGemeenteDigits(g.cbsCode);
    if (d) set.add(d);
  }
  return set;
}

export interface CoverageReport {
  /** Digits in manifest but not in uitslagen */
  missingInUitslagen: string[];
  /** Digits in uitslagen but not in manifest (often empty for same election) */
  missingInManifest: string[];
}

export function compareManifestToUitslagen(
  manifestGmCodes: readonly string[],
  uitslagenDigits: ReadonlySet<string>,
): CoverageReport {
  const manifestDigits = new Set<string>();
  for (const gm of manifestGmCodes) {
    const d = extractGemeenteDigits(gm);
    if (d) manifestDigits.add(d);
  }

  const missingInUitslagen: string[] = [];
  for (const d of manifestDigits) {
    if (!uitslagenDigits.has(d)) missingInUitslagen.push(d);
  }
  missingInUitslagen.sort();

  const missingInManifest: string[] = [];
  for (const d of uitslagenDigits) {
    if (!manifestDigits.has(d)) missingInManifest.push(d);
  }
  missingInManifest.sort();

  return { missingInUitslagen, missingInManifest };
}
