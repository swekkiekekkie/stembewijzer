export interface NosFetchLogRow {
  gmCode: string;
  /** CBS-code zoals in de URL: `G0893`. */
  gCode: string;
  label: string;
  url: string;
  status: number;
  fetchedAt: string;
  sha256: string;
  contentLength: number;
  error: string | null;
}

export interface NosRunMeta {
  baseUrl: string;
  electionPath: string;
  /** Willekeurige volgorde (Fisher–Yates). */
  shuffled: true;
  delayMs: number;
  jitterMs: number;
  userAgent: string;
  startedAt: string;
  finishedAt: string | null;
  aborted: boolean;
  abortReason: string | null;
  totalRequests: number;
  okCount: number;
  notFoundCount: number;
  errorCount: number;
}
