/**
 * CBS gemeentecodes in this project:
 * - StemWijzer CDN paths: `GM` + 4 digits (e.g. `GM0907`)
 * - Official results JSON (`uitslagen.json`): `G` + 4 digits (e.g. `G0907`)
 */

const CODE = /^(?:GM|G)(\d{4})$/i;

/** Four-digit numeric part, e.g. `"0907"`. */
export type GemeenteDigits = string;

export function extractGemeenteDigits(input: string): GemeenteDigits | null {
  const m = String(input).trim().match(CODE);
  return m ? m[1]! : null;
}

export function toGmCode(input: string): string {
  const d = extractGemeenteDigits(input);
  if (!d) throw new Error(`Invalid gemeente code: ${input}`);
  return `GM${d}`;
}

/** Same digits as in `uitslagen.json` → `gemeente.cbs_code`. */
export function toUitslagenCode(input: string): string {
  const d = extractGemeenteDigits(input);
  if (!d) throw new Error(`Invalid gemeente code: ${input}`);
  return `G${d}`;
}
