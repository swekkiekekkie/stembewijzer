import type { StemwijzerCleanBundle } from "./domain";
import type { CleanGemeenteUitslag, UitslagenCleanBundle } from "../uitslagen/domain";

function normalizePartyLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Per StemWijzer-partij: komt dezelfde `short_name` voor in de landelijke uitslag? */
export interface StemwijzerPartyVersusLandelijk {
  stemwijzerShortName: string;
  stemwijzerFullName: string;
  participates: boolean;
  inLandelijkeUitslag: boolean;
  landelijkeZetels: number | null;
  /** Als landelijk bekend: vergelijk lange naam (genormaliseerd). */
  longNameMatchesLandelijk: boolean | null;
  landelijkeLongName: string | null;
}

export interface GemeentePartyAlignmentReport {
  /** Alle StemWijzer-partijen vs landelijke register. */
  stemwijzerVsLandelijk: StemwijzerPartyVersusLandelijk[];
  /** `eerste_partij.short_name` komt voor als StemWijzer-partij (zelfde shortName). */
  eersteInStemwijzer: boolean;
  /** `tweede_partij.short_name` komt voor als StemWijzer-partij. */
  tweedeInStemwijzer: boolean;
  /** Short names die wél in StemWijzer staan maar niet in landelijke uitslag (vaak lokaal). */
  stemwijzerShortNamesNotInLandelijk: string[];
}

function buildLandelijkByShortName(
  bundle: UitslagenCleanBundle,
): Map<string, { longName: string; zetels: number }> {
  const m = new Map<string, { longName: string; zetels: number }>();
  for (const row of bundle.landelijk.partijen) {
    const sn = row.party.shortName;
    m.set(sn, {
      longName: row.party.name,
      zetels: row.current.zetels,
    });
  }
  return m;
}

function stemwijzerShortNameSet(bundle: StemwijzerCleanBundle): Set<string> {
  return new Set(bundle.parties.map((p) => p.shortName));
}

/**
 * Vergelijkt StemWijzer-partijen met:
 * - landelijke uitslag (`short_name` + lange naam + zetels),
 * - gemeentelijke 1e/2e partij (staan die in de StemWijzer-lijst).
 */
export function computeGemeentePartyAlignment(
  stemwijzer: StemwijzerCleanBundle,
  gemeenteUitslag: CleanGemeenteUitslag | null,
  uitslagenBundle: UitslagenCleanBundle,
): GemeentePartyAlignmentReport {
  const landelijk = buildLandelijkByShortName(uitslagenBundle);
  const swShorts = stemwijzerShortNameSet(stemwijzer);

  const stemwijzerVsLandelijk: StemwijzerPartyVersusLandelijk[] = [];
  const stemwijzerOnlyShortNames: string[] = [];

  for (const p of stemwijzer.parties) {
    const hit = landelijk.get(p.shortName);
    const inL = hit != null;
    if (!inL) stemwijzerOnlyShortNames.push(p.shortName);

    let longNameMatches: boolean | null = null;
    if (hit) {
      longNameMatches =
        normalizePartyLabel(p.fullName) === normalizePartyLabel(hit.longName);
    }

    stemwijzerVsLandelijk.push({
      stemwijzerShortName: p.shortName,
      stemwijzerFullName: p.fullName,
      participates: p.participates,
      inLandelijkeUitslag: inL,
      landelijkeZetels: hit ? hit.zetels : null,
      longNameMatchesLandelijk: longNameMatches,
      landelijkeLongName: hit ? hit.longName : null,
    });
  }

  const eersteIn =
    gemeenteUitslag != null &&
    swShorts.has(gemeenteUitslag.eerstePartij.shortName);
  const tweedeIn =
    gemeenteUitslag != null &&
    swShorts.has(gemeenteUitslag.tweedePartij.shortName);

  return {
    stemwijzerVsLandelijk,
    eersteInStemwijzer: eersteIn,
    tweedeInStemwijzer: tweedeIn,
    stemwijzerShortNamesNotInLandelijk: stemwijzerOnlyShortNames,
  };
}
