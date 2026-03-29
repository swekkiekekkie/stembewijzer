import type { CleanGemeenteUitslag } from "../uitslagen/domain";
import type { StemwijzerCleanBundle } from "./domain";
import type { GemeentePartyAlignmentReport } from "./partyAlignment";
import type { GemeenteJoinValidation } from "./validateJoin";

/** Eén gemeente: gedecodeerde StemWijzer + officiële uitslag (clean model). */
export interface GemeenteDatasetRow {
  gmCode: string;
  /** Vier cijfers, bv. "0907" — join-key met uitslagen. */
  gemeenteDigits: string;
  /** HTTP-status van de snapshot-run (0 = geen request / onbekend). */
  snapshotHttpStatus: number;
  snapshotUrl: string | null;
  /** Naam uit uitslagen (bron van waarheid voor “wie won”). */
  gemeenteNaamUitslagen: string | null;
  /** Naam uit StemWijzer `votematch` na normalisatie. */
  gemeenteNaamStemwijzer: string | null;
  /** Expliciete id’s uit gedecodeerde bundle (naast pad/uitslagen). */
  stemwijzerIds: {
    votematchNumericId: number;
    remoteId: string;
  } | null;
  /** Pad-GM vs `remote_id`, CBS vs uitslagen, gemeentenaam. */
  validation: GemeenteJoinValidation | null;
  /** StemWijzer-partijen vs landelijke `short_name`; 1e/2e gemeente vs StemWijzer-lijst. */
  partyAlignment: GemeentePartyAlignmentReport | null;
  /** Volledige clean uitslag (uit `normalizeUitslagenWire`). */
  uitslag: CleanGemeenteUitslag | null;
  stemwijzer: StemwijzerCleanBundle | null;
  decodeError: string | null;
}

export interface GemeenteDatasetFile {
  generatedAt: string;
  snapshotDir: string;
  uitslagenPath: string;
  rows: GemeenteDatasetRow[];
  stats: {
    rows: number;
    withStemwijzerJson: number;
    decodedOk: number;
    decodeFailed: number;
    /** `gmCode`s waar decode faalde (indien van toepassing). */
    decodeFailedGmCodes: string[];
    withUitslag: number;
    snapshot404: number;
  };
  validationStats: {
    rowsWithValidation: number;
    remoteIdMatchesPath: number;
    remoteIdMatchesUitslagenCbs: number;
    pathMatchesUitslagenCbs: number;
    naamEqualNormalized: number;
    naamMismatchLevenshteinGt0: number;
    /** Voorbeelden waar naam afwijkt (max 30). */
    naamMismatchSamples: { gmCode: string; stemwijzer: string; uitslagen: string; levenshtein: number }[];
  };
  partyAlignmentStats: {
    rowsWithPartyAlignment: number;
    eersteInStemwijzerCount: number;
    tweedeInStemwijzerCount: number;
    eersteNotInStemwijzerCount: number;
    tweedeNotInStemwijzerCount: number;
    /** Rijen waar minstens één StemWijzer-partij geen landelijke `short_name` heeft. */
    rowsWithLocalOnlyParties: number;
    /** Rijen waar een landelijk bekende partij afwijkende lange naam heeft. */
    rowsWithLongNameMismatch: number;
  };
}
