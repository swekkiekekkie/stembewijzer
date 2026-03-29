import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FetchLogRow, ManifestEntry, RunMeta } from "./types.ts";

export interface SnapshotOptions {
  projectRoot: string;
  outDir: string;
  baseUrl: string;
  /** Only `data.json` for now. */
  fileName: string;
  delayMs: number;
  jitterMs: number;
  userAgent: string;
  /** Optional URL/email; sent as `X-Stembewijzer-Contact` (not the User-Agent). */
  contactHeader: string | null;
  /** `Referer` + `Origin` (zelfde als in de browser; CDN kan hierop checken). */
  stemwijzerPageOrigin: string;
  maxRetries5xx: number;
  /** 0 = disabled. Otherwise abort when this many 404s occur in a row. */
  maxConsecutive404: number;
  requestTimeoutMs: number;
  dryRun: boolean;
  /** Limit manifest length (for testing). */
  limit: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitteredDelay(base: number, jitter: number): number {
  if (jitter <= 0) return base;
  return base + Math.floor(Math.random() * jitter);
}

function dataUrl(baseUrl: string, gmCode: string, fileName: string): string {
  const b = baseUrl.replace(/\/+$/, "");
  return `${b}/${gmCode}/${fileName}`;
}

/** Headers die overeenkomen met een echte request vanaf gr2026.stemwijzer.nl (CORS / CDN). */
export function stemwijzerBrowserLikeHeaders(
  userAgent: string,
  pageOrigin: string,
  contactHeader: string | null,
): Record<string, string> {
  const origin = pageOrigin.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    Accept: "*/*",
    "Accept-Language": "nl,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Referer: `${origin}/`,
    Origin: origin,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    Priority: "u=4",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
    "User-Agent": userAgent,
  };
  if (contactHeader) headers["X-Stembewijzer-Contact"] = contactHeader;
  return headers;
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
        await sleep(500 * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < opts.maxRetries5xx) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface SnapshotResult {
  meta: RunMeta;
  log: FetchLogRow[];
  aborted: boolean;
}

export async function runSnapshot(
  manifest: ManifestEntry[],
  opts: SnapshotOptions,
): Promise<SnapshotResult> {
  const startedAt = new Date().toISOString();
  const pathTemplate = "/{gmCode}/" + opts.fileName;

  const meta: RunMeta = {
    baseUrl: opts.baseUrl,
    pathTemplate,
    delayMs: opts.delayMs,
    jitterMs: opts.jitterMs,
    sequential: true,
    userAgent: opts.userAgent,
    stemwijzerPageOrigin: opts.stemwijzerPageOrigin,
    startedAt,
    finishedAt: null,
    aborted: false,
    abortReason: null,
    totalRequests: 0,
    okCount: 0,
    notFoundCount: 0,
    errorCount: 0,
  };

  const list = opts.limit != null ? manifest.slice(0, opts.limit) : manifest;
  const log: FetchLogRow[] = [];
  let consecutive404 = 0;

  mkdirSync(opts.outDir, { recursive: true });

  const headers = stemwijzerBrowserLikeHeaders(
    opts.userAgent,
    opts.stemwijzerPageOrigin,
    opts.contactHeader,
  );

  const runOne = async (entry: ManifestEntry): Promise<void> => {
    if (meta.aborted) return;
    const url = dataUrl(opts.baseUrl, entry.gmCode, opts.fileName);
    meta.totalRequests += 1;

    if (opts.dryRun) {
      log.push({
        gmCode: entry.gmCode,
        label: entry.label,
        url,
        status: 0,
        fetchedAt: new Date().toISOString(),
        sha256: "",
        contentLength: 0,
        parseOk: null,
        error: "dry-run",
      });
      return;
    }

    let res: Response;
    try {
      res = await fetchWithRetry(url, { headers }, {
        maxRetries5xx: opts.maxRetries5xx,
        timeoutMs: opts.requestTimeoutMs,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.push({
        gmCode: entry.gmCode,
        label: entry.label,
        url,
        status: 0,
        fetchedAt: new Date().toISOString(),
        sha256: "",
        contentLength: 0,
        parseOk: null,
        error: msg,
      });
      meta.errorCount += 1;
      return;
    }

    const status = res.status;
    const buf = Buffer.from(await res.arrayBuffer());
    const sha256 = createHash("sha256").update(buf).digest("hex");

    if (status === 403 || status === 429) {
      meta.aborted = true;
      meta.abortReason = `HTTP ${status} on ${entry.gmCode} — stopping entire run`;
      log.push({
        gmCode: entry.gmCode,
        label: entry.label,
        url,
        status,
        fetchedAt: new Date().toISOString(),
        sha256,
        contentLength: buf.length,
        parseOk: null,
        error: meta.abortReason,
      });
      return;
    }

    if (status === 404) {
      consecutive404 += 1;
      meta.notFoundCount += 1;
      log.push({
        gmCode: entry.gmCode,
        label: entry.label,
        url,
        status,
        fetchedAt: new Date().toISOString(),
        sha256,
        contentLength: buf.length,
        parseOk: null,
        error: "not found",
      });
      if (opts.maxConsecutive404 > 0 && consecutive404 >= opts.maxConsecutive404) {
        meta.aborted = true;
        meta.abortReason = `${opts.maxConsecutive404} consecutive 404 responses — stopping`;
      }
      return;
    }

    consecutive404 = 0;

    if (status < 200 || status >= 300) {
      meta.errorCount += 1;
      log.push({
        gmCode: entry.gmCode,
        label: entry.label,
        url,
        status,
        fetchedAt: new Date().toISOString(),
        sha256,
        contentLength: buf.length,
        parseOk: null,
        error: `unexpected status`,
      });
      return;
    }

    meta.okCount += 1;
    const outFile = resolve(opts.outDir, `${entry.gmCode}.json`);
    writeFileSync(outFile, buf);

    log.push({
      gmCode: entry.gmCode,
      label: entry.label,
      url,
      status,
      fetchedAt: new Date().toISOString(),
      sha256,
      contentLength: buf.length,
      parseOk: null,
      error: null,
    });
  };

  for (let i = 0; i < list.length; i++) {
    const entry = list[i]!;
    if (meta.aborted) break;
    await runOne(entry);
    if (meta.aborted) break;
    if (opts.dryRun) continue;
    if (i < list.length - 1) {
      const delay = jitteredDelay(opts.delayMs, opts.jitterMs);
      if (delay > 0) await sleep(delay);
    }
  }

  meta.finishedAt = new Date().toISOString();
  meta.aborted = meta.aborted || false;

  const jsonl = log.map((row) => JSON.stringify(row)).join("\n") + "\n";
  writeFileSync(resolve(opts.outDir, "fetch-log.jsonl"), jsonl, "utf8");
  writeFileSync(resolve(opts.outDir, "run-meta.json"), JSON.stringify(meta, null, 2), "utf8");

  const csvHeader =
    "gm_code,label,url,status,fetched_at,sha256,content_length,parse_ok,error\n";
  const csvBody = log
    .map((r) =>
      [
        r.gmCode,
        csvEscape(r.label),
        csvEscape(r.url),
        String(r.status),
        r.fetchedAt,
        r.sha256,
        String(r.contentLength),
        r.parseOk === null ? "" : String(r.parseOk),
        csvEscape(r.error ?? ""),
      ].join(","),
    )
    .join("\n");
  writeFileSync(resolve(opts.outDir, "fetch-log.csv"), csvHeader + csvBody + "\n", "utf8");

  return { meta, log, aborted: meta.aborted };
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
