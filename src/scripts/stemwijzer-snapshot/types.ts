export interface ManifestEntry {
  /** e.g. GM0907 */
  gmCode: string;
  /** Human label from scrape_data */
  label: string;
  published: boolean;
}

export interface FetchLogRow {
  gmCode: string;
  label: string;
  url: string;
  status: number;
  fetchedAt: string;
  /** Hex sha256 of response body bytes (empty if no body stored). */
  sha256: string;
  contentLength: number;
  /** Filled by `snapshot:validate` */
  parseOk: boolean | null;
  error: string | null;
}

export interface RunMeta {
  baseUrl: string;
  pathTemplate: string;
  delayMs: number;
  jitterMs: number;
  /** Always 1 (sequential snapshot). */
  sequential: true;
  userAgent: string;
  /** Referer/Origin host (e.g. https://gr2026.stemwijzer.nl) — moet matchen met de live app. */
  stemwijzerPageOrigin: string;
  startedAt: string;
  finishedAt: string | null;
  aborted: boolean;
  abortReason: string | null;
  totalRequests: number;
  okCount: number;
  notFoundCount: number;
  errorCount: number;
}
