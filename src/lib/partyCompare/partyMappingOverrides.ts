/**
 * Handmatige correcties op greedy matching (bekende fouten).
 * Alleen gebruiken waar heuristiek structureel faalt.
 */
export interface PartyMappingOverride {
  gmCode: string;
  stemwijzerShortName: string;
  nosShortName: string;
}

export const PARTY_MAPPING_OVERRIDES: readonly PartyMappingOverride[] = [
  /** Greedy koppelde “Burger Belangen Enschede” aan ENSCHE / EnschedeAnders.nl i.p.v. BBE. */
  { gmCode: "GM0153", stemwijzerShortName: "Burger Belangen Enschede", nosShortName: "BBE" },
  /** NOS: “GB! Lokaal op 1” (GEMBEL) —zelfde lijst als StemWijzer “Gemeentebelangen Renkum”. */
  { gmCode: "GM0274", stemwijzerShortName: "Gemeentebelangen Renkum", nosShortName: "GEMBEL" },
  /**
   * Blanco Muiderberg ↔ BLANCO; “Goois Democratisch Platform” ↔ GDP (was verwisseld door scores).
   */
  { gmCode: "GM1942", stemwijzerShortName: "Muiderberg aan Zet", nosShortName: "BLANCO" },
];
