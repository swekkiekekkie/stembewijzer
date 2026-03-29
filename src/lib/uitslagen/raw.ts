/**
 * Exacte JSON-vorm van `data/uitslagen.json` (snake_case, zoals de bron).
 * Gemeente-rijen bevatten minder velden dan de landelijke totalen.
 */

export interface UitslagenWirePartijRef {
  name: string;
  short_name: string;
}

export interface UitslagenWireGemeenteProvincie {
  code: string;
  naam: string;
  aantal_inwoners: number;
}

export interface UitslagenWireGemeente {
  naam: string;
  cbs_code: string;
  provincie: UitslagenWireGemeenteProvincie | null;
  kieskring: unknown | null;
  aantal_inwoners: number;
}

export interface UitslagenWireGemeenteOpkomst {
  opkomst_promillage: number;
}

export interface UitslagenWireGemeenteRow {
  status: string;
  publicatie_datum_tijd: string;
  gemeente: UitslagenWireGemeente;
  huidige_verkiezing: UitslagenWireGemeenteOpkomst;
  vorige_verkiezing: UitslagenWireGemeenteOpkomst;
  eerste_partij: UitslagenWirePartijRef;
  tweede_partij: UitslagenWirePartijRef;
}

/** Totalen op landelijk niveau (GR26 / GR22). */
export interface UitslagenWireLandelijkTotaal {
  verkiezing_code: string;
  kiesgerechtigden: number;
  zetels: number;
  opkomst: number;
  opkomst_promillage: number;
  ongeldig: number;
  ongeldig_promillage: number;
  blanco: number;
  blanco_promillage: number;
}

export interface UitslagenWirePartijStemCijfers {
  verkiezing_code: string;
  stemmen: number;
  stemmen_promillage: number;
  zetels: number;
}

export interface UitslagenWireLandelijkePartijRow {
  partij: UitslagenWirePartijRef;
  huidig: UitslagenWirePartijStemCijfers;
  vorig: UitslagenWirePartijStemCijfers;
}

export interface UitslagenWireLandelijkeUitslag {
  publicatie_datum_tijd: string;
  aantal_uitslagen: number;
  huidige_verkiezing: UitslagenWireLandelijkTotaal;
  vorige_verkiezing: UitslagenWireLandelijkTotaal;
  partijen: UitslagenWireLandelijkePartijRow[];
}

/** Top-level document van `uitslagen.json`. */
export interface UitslagenWireRoot {
  gemeentes: UitslagenWireGemeenteRow[];
  landelijke_uitslag: UitslagenWireLandelijkeUitslag;
}
