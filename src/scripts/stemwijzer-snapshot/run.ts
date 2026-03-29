/**
 * Manifest-first snapshot of StemWijzer CDN `data.json` files.
 *
 * Usage:
 *   npm run snapshot:stemwijzer -- --dry-run
 *   npm run snapshot:stemwijzer -- --limit 5
 *   npm run snapshot:stemwijzer
 *
 * Defaults (~4s + jitter): bewust rustig; bij HTTP 403/429 stopt de run meteen —
 * verhoog dan `--delay-ms` / `--jitter-ms` en probeer later opnieuw.
 *
 * Env:
 *   STEMWIJZER_BASE_URL        default https://gr2026-data.stemwijzer.nl
 *   STEMWIJZER_PAGE_ORIGIN     default https://gr2026.stemwijzer.nl (Referer/Origin; CDN verwacht dit)
 *   STEMWIJZER_USER_AGENT      default Firefox-achtig (zoals de live site)
 *   STEMWIJZER_CONTACT_URL     optioneel; wordt als X-Stembewijzer-Contact meegestuurd
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { buildManifest } from "./manifest.ts";
import { runSnapshot } from "./snapshot.ts";
import {
  compareManifestToUitslagen,
  loadUitslagenDigitSet,
} from "./uitslagen.ts";

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function parseIntArg(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const projectRoot = process.cwd();

  const dryRun = hasFlag(argv, "--dry-run");
  const skipCoverage = hasFlag(argv, "--skip-coverage");
  const limit = argValue(argv, "--limit");
  const limitN = limit !== undefined ? parseIntArg(limit, 0) : null;
  const outDirArg = argValue(argv, "--out");

  const baseUrl =
    process.env.STEMWIJZER_BASE_URL?.trim() ||
    "https://gr2026-data.stemwijzer.nl";
  const stemwijzerPageOrigin =
    process.env.STEMWIJZER_PAGE_ORIGIN?.trim() ||
    "https://gr2026.stemwijzer.nl";
  const contact = process.env.STEMWIJZER_CONTACT_URL?.trim();
  const userAgent =
    process.env.STEMWIJZER_USER_AGENT?.trim() ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0";

  const delayMs = parseIntArg(argValue(argv, "--delay-ms"), 4000);
  const jitterMs = parseIntArg(argValue(argv, "--jitter-ms"), 400);
  const maxRetries5xx = Math.max(0, parseIntArg(argValue(argv, "--max-retries-5xx"), 3));
  const maxConsecutive404 = Math.max(
    0,
    parseIntArg(argValue(argv, "--abort-consecutive-404s"), 0),
  );
  const requestTimeoutMs = parseIntArg(argValue(argv, "--timeout-ms"), 60_000);

  const date = new Date().toISOString().slice(0, 10);
  const outDir =
    outDirArg !== undefined
      ? resolve(projectRoot, outDirArg)
      : resolve(projectRoot, "data/stemwijzer-snapshots", date);

  const manifest = buildManifest(projectRoot);
  console.error(`Manifest: ${manifest.length} gemeenten (published)`);

  if (!skipCoverage) {
    try {
      const uDigits = loadUitslagenDigitSet(projectRoot);
      const cov = compareManifestToUitslagen(
        manifest.map((m) => m.gmCode),
        uDigits,
      );
      console.error(
        `Uitslagen coverage: ${cov.missingInUitslagen.length} manifest codes missing in data/uitslagen.json`,
      );
      if (cov.missingInUitslagen.length > 0) {
        console.error("  (digits)", cov.missingInUitslagen.slice(0, 20).join(", "), "...");
      }
      console.error(
        `  ${cov.missingInManifest.length} uitslagen gemeenten not in scrape manifest`,
      );
    } catch (e) {
      console.error("Coverage check skipped (uitslagen.json missing?):", e);
    }
  }

  mkdirSync(outDir, { recursive: true });

  const result = await runSnapshot(manifest, {
    projectRoot,
    outDir,
    baseUrl,
    fileName: "data.json",
    delayMs,
    jitterMs,
    userAgent,
    stemwijzerPageOrigin,
    contactHeader: contact ?? null,
    maxRetries5xx,
    maxConsecutive404,
    requestTimeoutMs,
    dryRun,
    limit: limitN && limitN > 0 ? limitN : null,
  });

  console.error("Output:", outDir);
  console.error(
    JSON.stringify(
      {
        aborted: result.aborted,
        ok: result.meta.okCount,
        notFound: result.meta.notFoundCount,
        errors: result.meta.errorCount,
        abortReason: result.meta.abortReason,
      },
      null,
      2,
    ),
  );

  if (result.aborted) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
