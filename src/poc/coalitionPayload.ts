import type { StatementKey, StemwijzerCleanBundle } from "@/lib/stembewijzer/domain";
import { positionLabelNl } from "@/lib/poc/pocQuestionZetels";
import type { QuestionZetelResult, ZetelSegment } from "@/lib/poc/pocQuestionZetels";
import type {
  CoalitionPartyRow,
  CoalitionRequestBody,
  CoalitionZetelAggregaten,
} from "@/lib/gemini/coalitionTypes";

export function buildCoalitionRows(
  bundle: StemwijzerCleanBundle,
  statementKey: StatementKey,
  qResult: QuestionZetelResult,
): CoalitionPartyRow[] {
  const rows: CoalitionPartyRow[] = [];

  const add = (seg: ZetelSegment, side: CoalitionPartyRow["side"]) => {
    const p = bundle.parties.find((x) => x.shortName === seg.stemwijzerShortName);
    const pos = p?.positions[statementKey];
    rows.push({
      side,
      positionLabel: pos ? positionLabelNl(pos) : side,
      partyShortName: seg.stemwijzerShortName,
      zetels: seg.zetels,
      explanation: p?.explanations[statementKey]?.trim() ?? "",
    });
  };

  for (const s of qResult.ja) add(s, "ja");
  for (const s of qResult.nee) add(s, "nee");
  for (const s of qResult.neutraal) add(s, "neutraal");

  rows.sort((a, b) => a.partyShortName.localeCompare(b.partyShortName, "nl"));
  return rows;
}

export function buildZetelAggregaten(q: QuestionZetelResult): CoalitionZetelAggregaten {
  return {
    totalRaadZetels: q.totalRaadZetels,
    somJa: q.somJa,
    somNee: q.somNee,
    somNeutraal: q.somNeutraal,
    somOverigeRaad: q.somOverigeRaad,
  };
}

export function buildCoalitionRequestBody(
  gmCode: string,
  gemeenteLabel: string,
  statementKey: StatementKey,
  statementTitle: string,
  qResult: QuestionZetelResult,
  majoritySummary: string,
  rows: CoalitionPartyRow[],
): CoalitionRequestBody {
  const zetelAggregaten = buildZetelAggregaten(qResult);
  return {
    gmCode,
    gemeenteLabel,
    statementKey,
    statementTitle,
    totalRaadZetels: zetelAggregaten.totalRaadZetels,
    zetelAggregaten,
    majoritySummary,
    rows,
  };
}
