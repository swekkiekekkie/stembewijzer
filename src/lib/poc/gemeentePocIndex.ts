import type { MappingEdgeLike } from "./pocQuestionZetels";

import mapping from "@data/processed/party-likely-mapping.json";
import compare from "@data/processed/party-compare-stemwijzer-nos.json";

export interface GemeentePocOption {
  gmCode: string;
  naam: string;
  edges: MappingEdgeLike[];
}

export function buildGemeentePocIndex(): GemeentePocOption[] {
  const m = mapping as { rows: Array<{ gmCode: string; edges: MappingEdgeLike[] }> };
  const c = compare as {
    rows: Array<{
      gmCode: string;
      gemeenteNaamStemwijzer: string | null;
      gemeenteNaamNos: string | null;
    }>;
  };
  const byGm = new Map(m.rows.map((r) => [r.gmCode, r.edges]));
  return c.rows.map((row) => ({
    gmCode: row.gmCode,
    naam: row.gemeenteNaamStemwijzer ?? row.gemeenteNaamNos ?? row.gmCode,
    edges: byGm.get(row.gmCode) ?? [],
  }));
}
