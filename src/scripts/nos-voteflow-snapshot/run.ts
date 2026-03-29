/**
 * NOS VoteFlow API — extreem rustig: willekeurige volgorde + lange delay + jitter.
 *
 *   npm run snapshot:nos-voteflow -- --dry-run
 *   npm run snapshot:nos-voteflow -- --limit 3
 *   npm run snapshot:nos-voteflow
 *
 * Env: NOS_VOTEFLOW_BASE_URL (default https://voteflow.api.nos.nl), NOS_CONTACT_URL
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { toUitslagenCode } from "../../lib/stembewijzer/cbs";
import { buildManifest } from "../stemwijzer-snapshot/manifest.ts";
import type { NosFetchLogRow, NosRunMeta } from "./types.ts";

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitteredDelay(base: number, jitter: number): number {
  if (jitter <= 0) return base;
  return base + Math.floor(Math.random() * jitter);
}

/** Fisher–Yates shuffle (in-place kopie). */
function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function nosHeaders(userAgent: string, contact: string | undefined): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "nl,en;q=0.9",
    Referer: "https://nos.nl/",
    Origin: "https://nos.nl",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "User-Agent": userAgent,
  };
  if (contact) h["X-Contact"] = contact;
  return h;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { maxRetries5xx: number; timeoutMs: number },
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries5xx; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status >= 500 && res.status < 600 && attempt < opts.maxRetries5xx) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < opts.maxRetries5xx) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const projectRoot = process.cwd();
  const dryRun = hasFlag(argv, "--dry-run");
  const limitN =
    argValue(argv, "--limit") !== undefined
      ? Math.max(0, parseIntArg(argValue(argv, "--limit"), 0))
      : null;
  const outDirArg = argValue(argv, "--out");

  const baseUrl =
    process.env.NOS_VOTEFLOW_BASE_URL?.replace(/\/+$/, "") ||
    "https://voteflow.api.nos.nl";
  const electionPath = process.env.NOS_VOTEFLOW_ELECTION?.trim() || "GR26";
  const contact = process.env.NOS_CONTACT_URL?.trim();
  const userAgent =
    process.env.NOS_USER_AGENT?.trim() ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0";

  const delayMs = parseIntArg(argValue(argv, "--delay-ms"), 12_000);
  const jitterMs = parseIntArg(argValue(argv, "--jitter-ms"), 6_000);
  const maxRetries5xx = Math.max(0, parseIntArg(argValue(argv, "--max-retries-5xx"), 2));
  const requestTimeoutMs = parseIntArg(argValue(argv, "--timeout-ms"), 90_000);

  const date = new Date().toISOString().slice(0, 10);
  const outDir =
    outDirArg !== undefined
      ? resolve(projectRoot, outDirArg)
      : resolve(projectRoot, "data/nos-voteflow-snapshots", date);

  const manifest = buildManifest(projectRoot);
  const order = shuffle(manifest);
  const list = limitN != null && limitN > 0 ? order.slice(0, limitN) : order;

  const meta: NosRunMeta = {
    baseUrl,
    electionPath,
    shuffled: true,
    delayMs,
    jitterMs,
    userAgent,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    aborted: false,
    abortReason: null,
    totalRequests: 0,
    okCount: 0,
    notFoundCount: 0,
    errorCount: 0,
  };

  const log: NosFetchLogRow[] = [];
  const headers = nosHeaders(userAgent, contact);

  mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < list.length; i++) {
    if (meta.aborted) break;
    const entry = list[i]!;
    const gCode = toUitslagenCode(entry.gmCode);
    const url = `${baseUrl}/${electionPath}/gemeente/${gCode}.json`;
    meta.totalRequests += 1;

    if (dryRun) {
      log.push({
        gmCode: entry.gmCode,
        gCode,
        label: entry.label,
        url,
        status: 0,
        fetchedAt: new Date().toISOString(),
        sha256: "",
        contentLength: 0,
        error: "dry-run",
      });
      continue;
    }

    let res: Response;
    try {
      res = await fetchWithRetry(url, { headers }, {
        maxRetries5xx,
        timeoutMs: requestTimeoutMs,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.push({
        gmCode: entry.gmCode,
        gCode,
        label: entry.label,
        url,
        status: 0,
        fetchedAt: new Date().toISOString(),
        sha256: "",
        contentLength: 0,
        error: msg,
      });
      meta.errorCount += 1;
      if (i < list.length - 1) await sleep(jitteredDelay(delayMs, jitterMs));
      continue;
    }

    const status = res.status;
    const buf = Buffer.from(await res.arrayBuffer());
    const sha256 = createHash("sha256").update(buf).digest("hex");

    if (status === 403 || status === 429) {
      meta.aborted = true;
      meta.abortReason = `HTTP ${status} op ${gCode} — run gestopt`;
      log.push({
        gmCode: entry.gmCode,
        gCode,
        label: entry.label,
        url,
        status,
        fetchedAt: new Date().toISOString(),
        sha256,
        contentLength: buf.length,
        error: meta.abortReason,
      });
      break;
    }

    if (status === 404) {
      meta.notFoundCount += 1;
      log.push({
        gmCode: entry.gmCode,
        gCode,
        label: entry.label,
        url,
        status,
        fetchedAt: new Date().toISOString(),
        sha256,
        contentLength: buf.length,
        error: "not found",
      });
    } else if (status >= 200 && status < 300) {
      meta.okCount += 1;
      const outFile = resolve(outDir, `${gCode}.json`);
      writeFileSync(outFile, buf);
      log.push({
        gmCode: entry.gmCode,
        gCode,
        label: entry.label,
        url,
        status,
        fetchedAt: new Date().toISOString(),
        sha256,
        contentLength: buf.length,
        error: null,
      });
    } else {
      meta.errorCount += 1;
      log.push({
        gmCode: entry.gmCode,
        gCode,
        label: entry.label,
        url,
        status,
        fetchedAt: new Date().toISOString(),
        sha256,
        contentLength: buf.length,
        error: `unexpected status`,
      });
    }

    if (meta.aborted) break;
    if (i < list.length - 1 && !dryRun) {
      await sleep(jitteredDelay(delayMs, jitterMs));
    }
  }

  meta.finishedAt = new Date().toISOString();

  const jsonl = log.map((row) => JSON.stringify(row)).join("\n") + "\n";
  writeFileSync(resolve(outDir, "fetch-log.jsonl"), jsonl, "utf8");
  writeFileSync(resolve(outDir, "run-meta.json"), JSON.stringify(meta, null, 2), "utf8");

  const csvHeader =
    "gm_code,g_code,label,url,status,fetched_at,sha256,content_length,error\n";
  const csvBody = log
    .map((r) =>
      [
        r.gmCode,
        r.gCode,
        csvEscape(r.label),
        csvEscape(r.url),
        String(r.status),
        r.fetchedAt,
        r.sha256,
        String(r.contentLength),
        csvEscape(r.error ?? ""),
      ].join(","),
    )
    .join("\n");
  writeFileSync(resolve(outDir, "fetch-log.csv"), csvHeader + csvBody + "\n", "utf8");

  console.error("Output:", outDir);
  console.error(
    JSON.stringify(
      {
        aborted: meta.aborted,
        ok: meta.okCount,
        notFound: meta.notFoundCount,
        errors: meta.errorCount,
        abortReason: meta.abortReason,
        order: "shuffle (random per run)",
        delayRangeMs: `${delayMs}–${delayMs + jitterMs}`,
      },
      null,
      2,
    ),
  );

  if (meta.aborted) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
