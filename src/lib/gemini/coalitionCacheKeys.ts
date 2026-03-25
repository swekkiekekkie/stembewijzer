import type {
  CoalitionPartyRow,
  CoalitionRequestBody,
  CoalitionZetelAggregaten,
} from "./coalitionTypes";

/** FNV-1a 32-bit voor stabiele cache-key (client + server). */
export function hashFingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export function coalitionPayloadFingerprint(
  rows: CoalitionPartyRow[],
  agg: CoalitionZetelAggregaten,
): string {
  return hashFingerprint(JSON.stringify({ rows, zetelAggregaten: agg }));
}

/** Bestandsnaam onder `data/coalition-cache/` (server + client fp moeten overeenkomen). */
export function coalitionServerCacheFileNameParts(
  gmCode: string,
  statementKey: string,
  fp: string,
): string {
  const safeGm = gmCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeStmt = statementKey.replace(/[^a-zA-Z0-9_:-]/g, "_").replace(/:/g, "-");
  return `${safeGm}__${safeStmt}__${fp}.json`;
}

export function coalitionServerCacheFileName(body: CoalitionRequestBody): string {
  const fp = coalitionPayloadFingerprint(body.rows, body.zetelAggregaten);
  return coalitionServerCacheFileNameParts(body.gmCode, body.statementKey, fp);
}
