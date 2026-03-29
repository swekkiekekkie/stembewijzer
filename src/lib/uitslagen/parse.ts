import type { UitslagenWireRoot } from "./raw";

export class UitslagenParseError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "UitslagenParseError";
  }
}

/** `JSON.parse` van het volledige officiële uitslagenbestand. */
export function parseUitslagenJson(jsonText: string): UitslagenWireRoot {
  try {
    return JSON.parse(jsonText) as UitslagenWireRoot;
  } catch (e) {
    throw new UitslagenParseError("JSON.parse mislukt voor uitslagen.json.", e);
  }
}
