/**
 * Wire-format types: exactly what `JSON.parse` returns from a decoded StemWijzer payload.
 * (StemWijzer / Kieskompas-style bundles: parties, statements, optional shootouts, votematch meta.)
 */

/** How a party answers a statement in the raw bundle. */
export type StemwijzerRawPosition = "agree" | "disagree" | "neither";

export interface StemwijzerRawAccessibilityCopy {
  explanation: string;
}

/** Party position on one statement (includes numeric id from upstream). */
export interface StemwijzerRawPartyStatement {
  id: number;
  position: StemwijzerRawPosition;
  explanation: StemwijzerRawWireString;
  accessibility: StemwijzerRawAccessibilityCopy;
}

export interface StemwijzerRawParty {
  id: number;
  name: string;
  fullName: string;
  logo: string;
  logoIndex: number;
  participates: boolean;
  website: string;
  hasSeats: boolean;
  statements: StemwijzerRawPartyStatement[];
}

/**
 * Soms levert de API copy als object (i.p. meertalig / toegankelijkheid), niet als platte string.
 */
export interface StemwijzerRawLocalizedString {
  text: string;
  information?: string;
  accessibility?: unknown;
}

/**
 * Platte string, woordenlijst-blok `{ text, information, … }`, of een **rij fragmenten**
 * (zin met inline-termen: `["Tekst ", { text: "term" }, " verder."]`).
 */
export type StemwijzerRawWireString =
  | string
  | StemwijzerRawLocalizedString
  | readonly StemwijzerRawWireString[];

export interface StemwijzerRawStatement {
  id: number;
  theme: StemwijzerRawWireString;
  themeId: string;
  title: StemwijzerRawWireString;
  isShootout: boolean;
  index: number;
}

export interface StemwijzerRawVotematch {
  id: number;
  name: StemwijzerRawWireString;
  context: string;
  date: string;
  remote_id: string;
  langcode: string;
}

/**
 * Parsed JSON document from the decoded file (after base64 + URI decoding).
 * Name is intentional: this is the “raw bundle” you get from `JSON.parse`.
 */
export interface StemwijzerRawBundle {
  parties: StemwijzerRawParty[];
  statements: StemwijzerRawStatement[];
  shootoutStatements: StemwijzerRawStatement[];
  votematch: StemwijzerRawVotematch;
}
