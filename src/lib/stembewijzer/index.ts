export type {
  StemwijzerRawAccessibilityCopy,
  StemwijzerRawBundle,
  StemwijzerRawLocalizedString,
  StemwijzerRawParty,
  StemwijzerRawPartyStatement,
  StemwijzerRawPosition,
  StemwijzerRawStatement,
  StemwijzerRawVotematch,
  StemwijzerRawWireString,
} from "./raw";

export { StemwijzerDecodeError, decodeStemwijzerPayload, parseStemwijzerJson } from "./decode";

export type {
  CleanElectionMeta,
  CleanParty,
  CleanStatement,
  PartyKey,
  Position,
  StatementKey,
  StemwijzerCleanBundle,
} from "./domain";

export {
  normalizeStemwijzerBundle,
  partyKeyFromName,
  statementKey,
  statementKeysInOrder,
  wireStringToPlain,
} from "./normalize";

export type {
  PartyVoteCount,
  PartyVoteShare,
  PositionAxis,
  SeatAllocation,
  UserAnswers,
} from "./votes";

export {
  allocateSeatsLargestRemainder,
  applyElectoralThreshold,
  axisDotProduct,
  countMatchingPositions,
  hammingDistance,
  positionToAxis,
  positionsEqual,
  summedAgreementScore,
  totalVotes,
  voteShares,
} from "./votes";

export type { GemeenteDigits } from "./cbs";
export { extractGemeenteDigits, toGmCode, toUitslagenCode } from "./cbs";

export type { GemeenteDatasetFile, GemeenteDatasetRow } from "./gemeenteDataset";

export type {
  GemeentePartyAlignmentReport,
  StemwijzerPartyVersusLandelijk,
} from "./partyAlignment";
export { computeGemeentePartyAlignment } from "./partyAlignment";

export type { GemeenteJoinValidation } from "./validateJoin";
export {
  expectedGmCodeFromUitslagen,
  validateStemwijzerUitslagenJoin,
} from "./validateJoin";

export type {
  CleanGemeenteUitslag,
  CleanLandelijkeUitslag,
  CleanLandelijkPartijUitslag,
  CleanLandelijkVerkiezingTotaal,
  CleanPartyRef,
  UitslagenCleanBundle,
  UitslagenWireGemeenteRow,
  UitslagenWireLandelijkeUitslag,
  UitslagenWirePartijRef,
  UitslagenWireRoot,
} from "../uitslagen";
export {
  normalizeUitslagenWire,
  parseUitslagenJson,
  UitslagenParseError,
} from "../uitslagen";
