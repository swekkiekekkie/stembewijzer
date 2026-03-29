import type { StemwijzerRawPosition } from "./raw";

/** Canonical three-way answer (matches wire `StemwijzerRawPosition`). */
export type Position = StemwijzerRawPosition;

/** Stable key for a statement: `themeId` + `index` (no upstream numeric id). */
export type StatementKey = `${string}:${number}`;

export interface CleanStatement {
  key: StatementKey;
  theme: string;
  themeId: string;
  title: string;
  orderIndex: number;
  isShootout: boolean;
}

/** Short slug used in maps and URLs (derived from party short name). */
export type PartyKey = string;

export interface CleanParty {
  key: PartyKey;
  shortName: string;
  fullName: string;
  /** Filename or path fragment from the bundle (e.g. `party_logo_114309.jpg`). */
  logoAsset: string;
  website: string | null;
  participates: boolean;
  hasSeats: boolean;
  /** Positions keyed by `StatementKey` (only participating statements present). */
  positions: Readonly<Record<StatementKey, Position>>;
  /** Optional explanations keyed by `StatementKey` (for UI / later NLP). */
  explanations: Readonly<Partial<Record<StatementKey, string>>>;
}

export interface CleanElectionMeta {
  /** Upstream `votematch.id` (ProDemos). */
  votematchNumericId: number;
  /** Human label, e.g. municipality name from votematch. */
  label: string;
  /** Machine context from bundle, e.g. `2026GR`. */
  context: string;
  /** Display date string from bundle (as provided). */
  date: string;
  /** Remote id from bundle (e.g. CBS-code als `GM0907`). */
  remoteId: string;
  langcode: string;
}

/**
 * Demangled dataset: no upstream numeric ids, statements and parties aligned by `StatementKey` / `PartyKey`.
 */
export interface StemwijzerCleanBundle {
  meta: CleanElectionMeta;
  statements: CleanStatement[];
  /** Usually the same statements as `statements`; kept separate if you merge shootouts later. */
  shootoutStatements: CleanStatement[];
  parties: CleanParty[];
}
