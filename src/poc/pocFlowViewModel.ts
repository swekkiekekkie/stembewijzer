import type { StatementKey } from "@/lib/stembewijzer/domain";

import type { QuestionZetelResult } from "@/lib/poc/pocQuestionZetels";

export interface PocFlowQueryState {
  gmCode: string | null;
  statementKey: StatementKey | null;
}

export interface RaadCoverageSummary {
  mappedZetels: number;
  totalRaadZetels: number;
  restZetels: number;
  coveragePct: number;
  coveragePctLabel: string;
  coverageLabel: string;
  restLabel: string;
  coverageSentence: string;
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const rounded = value % 1 < 0.05 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "");
  return `${rounded}%`;
}

export function formatSeatShare(zetels: number, totalRaad: number): string {
  if (totalRaad <= 0) return "—";
  return formatPct((zetels / totalRaad) * 100);
}

export function readPocFlowQuery(search: string): PocFlowQueryState {
  const params = new URLSearchParams(search);
  const gmCode = params.get("gmCode")?.trim() || null;
  const statementKey = params.get("statementKey")?.trim() || null;
  return {
    gmCode,
    statementKey: statementKey ? (statementKey as StatementKey) : null,
  };
}

export function replacePocFlowQuery(next: PocFlowQueryState): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (next.gmCode) {
    url.searchParams.set("gmCode", next.gmCode);
  } else {
    url.searchParams.delete("gmCode");
  }

  if (next.gmCode && next.statementKey) {
    url.searchParams.set("statementKey", next.statementKey);
  } else {
    url.searchParams.delete("statementKey");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

export function buildRaadCoverageSummary(result: QuestionZetelResult): RaadCoverageSummary {
  const mappedZetels = result.somJa + result.somNee + result.somNeutraal;
  const totalRaadZetels = result.totalRaadZetels;
  const restZetels = Math.max(0, result.somOverigeRaad);
  const coveragePct = totalRaadZetels > 0 ? (mappedZetels / totalRaadZetels) * 100 : 0;
  const coveragePctLabel = formatPct(coveragePct);

  return {
    mappedZetels,
    totalRaadZetels,
    restZetels,
    coveragePct,
    coveragePctLabel,
    coverageLabel: `${mappedZetels}/${totalRaadZetels} zetels in beeld (${coveragePctLabel})`,
    restLabel:
      restZetels > 0 ? `${restZetels} zetels buiten deze weging` : "Volledige raad in beeld",
    coverageSentence:
      restZetels > 0
        ? `Niet alle ${totalRaadZetels} raadszetels vallen in deze weging. ${restZetels} zetels blijven buiten beeld doordat partijen ontbreken in StemWijzer of niet eenduidig gemapt zijn.`
        : `Alle ${totalRaadZetels} raadszetels zitten in deze weging.`,
  };
}

export function humanizeGemeenteLoadError(error: string, gemeenteLabel?: string | null): string {
  const gemeenteText = gemeenteLabel ?? "deze gemeente";
  if (error.includes("Geen StemWijzer-snapshot") || error.includes("Geen NOS-snapshot")) {
    return `Voor ${gemeenteText} staat in deze snapshot nog geen complete combinatie van StemWijzer- en NOS-data klaar.`;
  }
  return `De gegevens voor ${gemeenteText} konden nu niet worden geladen. Probeer het later opnieuw of kies een andere gemeente.`;
}
