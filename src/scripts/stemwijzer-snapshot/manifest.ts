import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ManifestEntry } from "./types.ts";
import { toGmCode } from "../../lib/stembewijzer/cbs.ts";

interface ScrapeRow {
  value: string;
  label: string;
  customProperties?: { published?: boolean };
}

/**
 * Manifest-first: only known `/<GMxxxx>/data.json` paths from `data/scrape_data.json`.
 */
export function buildManifest(projectRoot: string): ManifestEntry[] {
  const path = resolve(projectRoot, "data/scrape_data.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as ScrapeRow[];
  if (!Array.isArray(raw)) throw new Error("scrape_data.json must be an array");

  const seen = new Set<string>();
  const out: ManifestEntry[] = [];

  for (const row of raw) {
    const gmCode = toGmCode(row.value);
    if (seen.has(gmCode)) continue;
    seen.add(gmCode);
    const published = row.customProperties?.published !== false;
    if (!published) continue;
    out.push({ gmCode, label: row.label, published: true });
  }

  out.sort((a, b) => a.gmCode.localeCompare(b.gmCode));
  return out;
}
