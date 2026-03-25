import { GoogleGenAI } from "@google/genai";

import { DEFAULT_GEMINI_MODEL } from "./client";
import { buildCoalitionPrompt } from "./coalitionPrompt";
import type { CoalitionRequestBody, CoalitionZetelAggregaten } from "./coalitionTypes";

function parseNonNegInt(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function validateZetelAggregaten(raw: unknown): CoalitionZetelAggregaten {
  if (!raw || typeof raw !== "object") {
    throw new Error("zetelAggregaten ontbreekt of is ongeldig.");
  }
  const z = raw as Record<string, unknown>;
  return {
    totalRaadZetels: parseNonNegInt(z.totalRaadZetels),
    somJa: parseNonNegInt(z.somJa),
    somNee: parseNonNegInt(z.somNee),
    somNeutraal: parseNonNegInt(z.somNeutraal),
    somOverigeRaad: parseNonNegInt(z.somOverigeRaad),
  };
}

/** Controleer dat sommen per kant gelijk zijn aan de opgegeven aggregaten (fouten in client/payload). */
function assertRowSumsMatchAggregates(
  rows: CoalitionRequestBody["rows"],
  agg: CoalitionZetelAggregaten,
): void {
  let ja = 0;
  let nee = 0;
  let neutraal = 0;
  for (const r of rows) {
    if (r.side === "ja") ja += r.zetels;
    else if (r.side === "nee") nee += r.zetels;
    else neutraal += r.zetels;
  }
  if (ja !== agg.somJa || nee !== agg.somNee || neutraal !== agg.somNeutraal) {
    throw new Error(
      "Zetelsommen kloppen niet: som van partij-zetels per blok komt niet overeen met zetelAggregaten.",
    );
  }
  const somGemapte = ja + nee + neutraal;
  if (agg.totalRaadZetels > 0 && somGemapte + agg.somOverigeRaad !== agg.totalRaadZetels) {
    throw new Error(
      "Zetelsommen kloppen niet: JA+NEE+NEUTRAAL+overige zou het totaal aantal raadszetels moeten zijn.",
    );
  }
}

export function validateCoalitionBody(body: unknown): CoalitionRequestBody {
  if (!body || typeof body !== "object") throw new Error("Body moet een object zijn.");
  const o = body as Record<string, unknown>;
  const rows = o.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("rows ontbreekt of is leeg.");
  }
  const gmCode = String(o.gmCode ?? "");
  const gemeenteLabel = String(o.gemeenteLabel ?? "");
  const statementKey = String(o.statementKey ?? "");
  const statementTitle = String(o.statementTitle ?? "");
  const majoritySummary = String(o.majoritySummary ?? "");
  if (!gmCode || !statementKey) throw new Error("gmCode of statementKey ontbreekt.");

  const zetelAggregaten = validateZetelAggregaten(o.zetelAggregaten);

  const outRows: CoalitionRequestBody["rows"] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const side = r.side;
    if (side !== "ja" && side !== "nee" && side !== "neutraal") continue;
    outRows.push({
      side,
      positionLabel: String(r.positionLabel ?? ""),
      partyShortName: String(r.partyShortName ?? ""),
      zetels: Math.max(0, Math.floor(Number(r.zetels))),
      explanation: String(r.explanation ?? ""),
    });
  }
  if (outRows.length === 0) throw new Error("Geen geldige rijen in rows.");

  assertRowSumsMatchAggregates(outRows, zetelAggregaten);

  const totalRaadZetels = parseNonNegInt(o.totalRaadZetels);
  if (totalRaadZetels !== zetelAggregaten.totalRaadZetels) {
    throw new Error("totalRaadZetels komt niet overeen met zetelAggregaten.totalRaadZetels.");
  }

  return {
    gmCode,
    gemeenteLabel,
    statementKey,
    statementTitle,
    totalRaadZetels,
    zetelAggregaten,
    majoritySummary,
    rows: outRows,
  };
}

export async function runCoalitionAnalysis(
  apiKey: string,
  body: CoalitionRequestBody,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const prompt = buildCoalitionPrompt(body);
  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: prompt,
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Geen tekst in Gemini-response.");
  return text;
}
