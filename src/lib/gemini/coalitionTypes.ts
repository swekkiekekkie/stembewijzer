/** Payload POST /api/gemini/coalition (zelfde vorm client ↔ server). */
export type CoalitionPartyRow = {
  side: "ja" | "nee" | "neutraal";
  /** StemWijzer-label voor het antwoord op deze stelling. */
  positionLabel: string;
  partyShortName: string;
  zetels: number;
  /** Kan leeg zijn als upstream geen toelichting gaf. */
  explanation: string;
};

/**
 * Geaggregeerde zetels (NOS, gemapt op StemWijzer voor deze stelling).
 * Moet consistent zijn met de som van `rows` per blok + `totalRaadZetels`.
 */
export type CoalitionZetelAggregaten = {
  /** Totaal zetels volledige raad (NOS). */
  totalRaadZetels: number;
  /** Som zetels van gemapte partijen met standpunt JA (eens) op deze stelling. */
  somJa: number;
  /** Som zetels van gemapte partijen met standpunt NEE (oneens). */
  somNee: number;
  /** Som zetels van gemapte partijen met standpunt neutraal. */
  somNeutraal: number;
  /**
   * Raadszetels die niet in deze weging vallen (geen StemWijzer-match, OVERIG, geen zetels, etc.).
   */
  somOverigeRaad: number;
};

export type CoalitionRequestBody = {
  gmCode: string;
  gemeenteLabel: string;
  statementKey: string;
  statementTitle: string;
  /** Zelfde als `zetelAggregaten.totalRaadZetels` (top-level voor backwards compatibility). */
  totalRaadZetels: number;
  /** Geaggregeerde zetels: altijd meesturen vóór livegang. */
  zetelAggregaten: CoalitionZetelAggregaten;
  /** Korte samenvatting, bv. theoretische meerderheid ja/nee/geen. */
  majoritySummary: string;
  /** Per partij: zetels + standpunt + toelichting. */
  rows: CoalitionPartyRow[];
};

/** POST /api/gemini/coalition — altijd `savedAt` + bron (disk = al gecached op de host). */
export type CoalitionResponseBody =
  | { ok: true; text: string; source: "disk" | "gemini"; savedAt: string }
  | { ok: false; error: string };

/** GET /api/gemini/coalition?gmCode&statementKey&fp — alleen lezen, geen Gemini. */
export type CoalitionGetResponseBody =
  | { ok: true; hit: true; text: string; savedAt: string }
  | { ok: true; hit: false }
  | { ok: false; error: string };
