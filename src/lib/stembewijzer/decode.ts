import type { StemwijzerRawBundle } from "./raw";

export class StemwijzerDecodeError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StemwijzerDecodeError";
  }
}

function base64ToUtf8String(base64: string): string {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    throw new StemwijzerDecodeError("Invalid base64 input.", e);
  }
}

/**
 * CDN levert soms `data.json` als **JSON-encoded string** (aanhalingstekens + escapes),
 * soms als ruwe base64. Beide worden ondersteund.
 */
function unwrapJsonStringIfNeeded(raw: string): string {
  const t = raw.trim();
  if (t.length < 2 || !t.startsWith('"')) return raw;
  try {
    const u = JSON.parse(t) as unknown;
    if (typeof u === "string") return u;
  } catch {
    /* niet JSON-string → direct base64 proberen */
  }
  return raw;
}

/**
 * Decodes the typical StemWijzer file: base64 → percent-encoded UTF-8 → JSON string → parse.
 */
export function decodeStemwijzerPayload(base64Text: string): StemwijzerRawBundle {
  const cleaned = unwrapJsonStringIfNeeded(base64Text).replace(/\s+/g, "");
  const urlEncoded = base64ToUtf8String(cleaned);
  let jsonText: string;
  try {
    jsonText = decodeURIComponent(urlEncoded);
  } catch (e) {
    throw new StemwijzerDecodeError("URI decoding failed (malformed percent-escapes).", e);
  }
  try {
    return JSON.parse(jsonText) as StemwijzerRawBundle;
  } catch (e) {
    throw new StemwijzerDecodeError("JSON.parse failed after decode.", e);
  }
}

/** When you already have the inner JSON string (not base64). */
export function parseStemwijzerJson(jsonText: string): StemwijzerRawBundle {
  try {
    return JSON.parse(jsonText) as StemwijzerRawBundle;
  } catch (e) {
    throw new StemwijzerDecodeError("JSON.parse failed.", e);
  }
}
