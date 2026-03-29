import type { StemwijzerCleanBundle } from "../stembewijzer/domain";
import type { NosVoteFlowGemeenteJson } from "../nosVoteFlow/raw";

export interface StemwijzerNosPartyDiff {
  gCode: string;
  gmCode: string;
  gemeenteNaamStemwijzer: string | null;
  gemeenteNaamNos: string | null;
  /** Aantal partijen in StemWijzer-bundle. */
  countStemwijzer: number;
  /** Aantal partijen in NOS VoteFlow JSON. */
  countNos: number;
  /** Zelfde aantal partijen. */
  countsMatch: boolean;
  /** `shortName` exact gelijk (na trim), beide kanten. */
  stemwijzerShortNamesSorted: string[];
  nosShortNamesSorted: string[];
  alleenInStemwijzer: string[];
  alleenInNos: string[];
  overlap: string[];
  /** Beide sets identiek (geen verschil). */
  setsMatch: boolean;
}

function sortUnique(arr: readonly string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()))].sort((a, b) => a.localeCompare(b));
}

function setDiff(a: readonly string[], b: readonly string[]): { onlyA: string[]; onlyB: string[]; both: string[] } {
  const setB = new Set(b);
  const setA = new Set(a);
  const onlyA = a.filter((x) => !setB.has(x));
  const onlyB = b.filter((x) => !setA.has(x));
  const both = a.filter((x) => setB.has(x));
  return { onlyA: sortUnique(onlyA), onlyB: sortUnique(onlyB), both: sortUnique(both) };
}

/**
 * Vergelijkt partij-`short_name` / `shortName` tussen StemWijzer (per gemeente) en NOS VoteFlow JSON.
 */
export function compareStemwijzerWithNosGemeente(
  stemwijzer: StemwijzerCleanBundle,
  nos: NosVoteFlowGemeenteJson,
  gmCode: string,
): StemwijzerNosPartyDiff {
  const sw = sortUnique(stemwijzer.parties.map((p) => p.shortName));
  const nv = sortUnique(nos.partijen.map((r) => r.partij.short_name));
  const { onlyA, onlyB, both } = setDiff(sw, nv);

  return {
    gCode: nos.gemeente.cbs_code,
    gmCode,
    gemeenteNaamStemwijzer: stemwijzer.meta.label,
    gemeenteNaamNos: nos.gemeente.naam,
    countStemwijzer: sw.length,
    countNos: nv.length,
    countsMatch: sw.length === nv.length,
    stemwijzerShortNamesSorted: sw,
    nosShortNamesSorted: nv,
    alleenInStemwijzer: onlyA,
    alleenInNos: onlyB,
    overlap: both,
    setsMatch: onlyA.length === 0 && onlyB.length === 0,
  };
}

export interface StemwijzerNosCompareSummary {
  generatedAt: string;
  stemwijzerSnapshotDir: string;
  nosSnapshotDir: string;
  gemeentenGeprobeerd: number;
  gemeentenMetStemwijzerEnNos: number;
  /** `countsMatch` */
  zelfdeAantal: number;
  /** `setsMatch` (exact dezelfde short_name-set) */
  zelfdeSet: number;
  /** Minstens één verschil in short_name-set */
  metVerschil: number;
  /** Gemeenten zonder StemWijzer-bestand of decode-fout */
  overgeslagen: { gmCode: string; reden: string }[];
  rows: StemwijzerNosPartyDiff[];
}
