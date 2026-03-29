import type { Position, StatementKey, StemwijzerCleanBundle } from "../stembewijzer/domain";
import type { NosVoteFlowGemeenteJson } from "../nosVoteFlow/raw";

export interface MappingEdgeLike {
  stemwijzerShortName: string;
  nosShortName: string;
}

export interface ZetelSegment {
  stemwijzerShortName: string;
  nosShortName: string;
  zetels: number;
}

export interface QuestionZetelResult {
  totalRaadZetels: number;
  /** Zetels meegenomen in ja/nee/neutraal (gemapte partijen met positie). */
  somJa: number;
  somNee: number;
  somNeutraal: number;
  /** Rest van de raad (niet in StemWijzer / niet gemapt / OVERIG). */
  somOverigeRaad: number;
  ja: ZetelSegment[];
  nee: ZetelSegment[];
  neutraal: ZetelSegment[];
}

/** Totaal raadszetels volgens NOS (zelfde bron als per-stelling-weging). */
export function totalRaadFromNos(nos: NosVoteFlowGemeenteJson): number {
  const hv = nos.huidige_verkiezing as { zetels?: unknown };
  if (typeof hv.zetels === "number" && hv.zetels > 0) return hv.zetels;
  let s = 0;
  for (const p of nos.partijen) s += p.huidig.zetels;
  return s;
}

/** Meerderheid t.o.v. volledige raad: strikt meer dan de helft van `total` zetels. */
export function councilMajorityCategory(
  total: number,
  somJa: number,
  somNee: number,
): "ja" | "nee" | "geen" {
  if (total <= 0) return "geen";
  const half = total / 2;
  if (somJa > half) return "ja";
  if (somNee > half) return "nee";
  return "geen";
}

/**
 * Zetels per antwoord (eens/oneens/neutral) op één stelling, gewogen met NOS-zetels
 * volgens de StemWijzer↔NOS mapping.
 */
export function computeQuestionZetelDistribution(
  bundle: StemwijzerCleanBundle,
  nos: NosVoteFlowGemeenteJson,
  edges: readonly MappingEdgeLike[],
  statementKey: StatementKey,
): QuestionZetelResult {
  const totalRaadZetels = totalRaadFromNos(nos);

  const nosZetels = new Map<string, number>();
  for (const row of nos.partijen) {
    nosZetels.set(row.partij.short_name, row.huidig.zetels);
  }

  const partyByShort = new Map(bundle.parties.map((p) => [p.shortName, p]));

  const ja: ZetelSegment[] = [];
  const nee: ZetelSegment[] = [];
  const neutraal: ZetelSegment[] = [];

  for (const e of edges) {
    if (e.nosShortName === "OVERIG") continue;
    const p = partyByShort.get(e.stemwijzerShortName);
    if (!p) continue;
    const pos = p.positions[statementKey] as Position | undefined;
    if (pos === undefined) continue;
    const z = nosZetels.get(e.nosShortName) ?? 0;
    if (z <= 0) continue;

    const seg: ZetelSegment = {
      stemwijzerShortName: e.stemwijzerShortName,
      nosShortName: e.nosShortName,
      zetels: z,
    };
    if (pos === "agree") ja.push(seg);
    else if (pos === "disagree") nee.push(seg);
    else neutraal.push(seg);
  }

  ja.sort((a, b) => b.zetels - a.zetels);
  nee.sort((a, b) => a.zetels - b.zetels);
  neutraal.sort((a, b) => b.zetels - a.zetels);

  const somJa = ja.reduce((s, x) => s + x.zetels, 0);
  const somNee = nee.reduce((s, x) => s + x.zetels, 0);
  const somNeutraal = neutraal.reduce((s, x) => s + x.zetels, 0);

  const somGemapteRaad = somJa + somNee + somNeutraal;
  const somOverigeRaad = Math.max(0, totalRaadZetels - somGemapteRaad);

  return {
    totalRaadZetels,
    somJa,
    somNee,
    somNeutraal,
    somOverigeRaad,
    ja,
    nee,
    neutraal,
  };
}

export function positionLabelNl(p: Position): string {
  if (p === "agree") return "Ja (eens)";
  if (p === "disagree") return "Nee (oneens)";
  return "Neutraal";
}
