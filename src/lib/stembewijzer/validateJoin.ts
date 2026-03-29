import type { CleanGemeenteUitslag } from "../uitslagen/domain";
import type { StemwijzerCleanBundle } from "./domain";
import { extractGemeenteDigits, toGmCode } from "./cbs.ts";

export interface GemeenteJoinValidation {
  /** `fetch` pad `GMxxxx` → 4 cijfers === cijfers in `votematch.remote_id`. */
  remoteIdDigitsMatchPathGm: boolean;
  /** `uitslagen.gemeente.cbs_code` → zelfde 4 cijfers als `remote_id`. */
  remoteIdDigitsMatchUitslagenCbs: boolean;
  /** `uitslagen.gemeente.cbs_code` === verwachte `G`+cijfers uit pad. */
  pathDigitsMatchUitslagenCbs: boolean;
  /** Naam StemWijzer (`meta.label`) vs officiële gemeentenaam: gelijk na normalisatie. */
  gemeenteNaamEqualNormalized: boolean;
  /** Levenshtein op genormaliseerde namen (null als één ontbreekt). */
  gemeenteNaamLevenshtein: number | null;
}

function normalizeGemeenteName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n]!;
}

export function validateStemwijzerUitslagenJoin(
  gmCodeFromPath: string,
  stemwijzer: StemwijzerCleanBundle,
  uitslagen: CleanGemeenteUitslag | null,
): GemeenteJoinValidation {
  const pathDigits = extractGemeenteDigits(gmCodeFromPath);
  const remoteDigits = extractGemeenteDigits(stemwijzer.meta.remoteId);
  const uitslagenDigits = uitslagen
    ? extractGemeenteDigits(uitslagen.cbsCode)
    : null;

  const remoteIdDigitsMatchPathGm =
    pathDigits != null && remoteDigits != null && pathDigits === remoteDigits;

  const remoteIdDigitsMatchUitslagenCbs =
    remoteDigits != null &&
    uitslagenDigits != null &&
    remoteDigits === uitslagenDigits;

  const pathDigitsMatchUitslagenCbs =
    pathDigits != null &&
    uitslagenDigits != null &&
    pathDigits === uitslagenDigits;

  const swName = normalizeGemeenteName(stemwijzer.meta.label);
  const offName = uitslagen
    ? normalizeGemeenteName(uitslagen.gemeenteNaam)
    : null;

  const gemeenteNaamEqualNormalized =
    offName != null && swName === offName;

  const gemeenteNaamLevenshtein =
    offName != null ? levenshtein(swName, offName) : null;

  return {
    remoteIdDigitsMatchPathGm,
    remoteIdDigitsMatchUitslagenCbs,
    pathDigitsMatchUitslagenCbs,
    gemeenteNaamEqualNormalized,
    gemeenteNaamLevenshtein,
  };
}

/** Controle: `toGmCode(uitslagen.cbs_code)` zou het snapshot-pad moeten zijn. */
export function expectedGmCodeFromUitslagen(cbsCode: string): string {
  return toGmCode(cbsCode);
}
