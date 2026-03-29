export type {
  UitslagenWireGemeente,
  UitslagenWireGemeenteOpkomst,
  UitslagenWireGemeenteProvincie,
  UitslagenWireGemeenteRow,
  UitslagenWireLandelijkePartijRow,
  UitslagenWireLandelijkeUitslag,
  UitslagenWireLandelijkTotaal,
  UitslagenWirePartijRef,
  UitslagenWirePartijStemCijfers,
  UitslagenWireRoot,
} from "./raw";

export type {
  CleanGemeenteUitslag,
  CleanLandelijkeUitslag,
  CleanLandelijkPartijUitslag,
  CleanLandelijkVerkiezingTotaal,
  CleanPartyRef,
  UitslagenCleanBundle,
} from "./domain";

export { UitslagenParseError, parseUitslagenJson } from "./parse";
export { normalizeUitslagenWire } from "./normalize";
