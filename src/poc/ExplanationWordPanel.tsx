import { useEffect, useMemo, useState } from "react";

import explanationWordStatsUrl from "@data/processed/explanation-word-stats.json?url";

import {
  BUILT_IN_UNINTERESTING_WORDS,
  buildLiveBundleWordAggregate,
  buildLivePartyWordAggregate,
  filterExplanationWordStats,
  findNationwidePartyAggregate,
  normalizeExplanationWordStatsFile,
  type ExplanationWordStatsFile,
} from "@/lib/explanationWords";
import type { MappingEdgeLike } from "@/lib/poc/pocQuestionZetels";
import type { NosVoteFlowGemeenteJson } from "@/lib/nosVoteFlow/raw";
import type { StatementKey, StemwijzerCleanBundle } from "@/lib/stembewijzer/domain";

import "./ExplanationWordPanel.css";

type Mode =
  | "local_party_all"
  | "local_party_current"
  | "local_all_all"
  | "local_all_current"
  | "nationwide_party"
  | "nationwide_all";

const HIDDEN_WORDS_STORAGE_KEY = "stembewijzer.hidden_explanation_words";
const VISIBLE_WORD_LIMIT = 40;

function loadHiddenWords(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_WORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function sortPartiesBySeatWeight(
  bundle: StemwijzerCleanBundle,
  nos: NosVoteFlowGemeenteJson,
  edges: readonly MappingEdgeLike[],
): Array<{ shortName: string; seats: number }> {
  const nosSeats = new Map(nos.partijen.map((row) => [row.partij.short_name, row.huidig.zetels] as const));
  const seatsByParty = new Map<string, number>();

  for (const edge of edges) {
    const seats = nosSeats.get(edge.nosShortName) ?? 0;
    seatsByParty.set(edge.stemwijzerShortName, Math.max(seatsByParty.get(edge.stemwijzerShortName) ?? 0, seats));
  }

  return bundle.parties
    .map((party) => ({
      shortName: party.shortName,
      seats: seatsByParty.get(party.shortName) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.seats - left.seats || left.shortName.localeCompare(right.shortName, "nl"),
    );
}

function aggregateMetaLabel(mode: Mode, currentStatementTitle: string): string {
  if (mode === "local_party_current") return `Huidige stelling · ${currentStatementTitle}`;
  if (mode === "local_party_all") return "Deze partij · alle stellingen";
  if (mode === "local_all_current") return `Deze gemeente · huidige stelling · alle partijen`;
  if (mode === "local_all_all") return "Deze gemeente · alle partijen · alle stellingen";
  if (mode === "nationwide_party") return "Zelfde partijlabel · heel Nederland";
  return "Alle partijen · heel Nederland";
}

export default function ExplanationWordPanel({
  bundle,
  nos,
  edges,
  statementKey,
  statementTitle,
}: {
  bundle: StemwijzerCleanBundle;
  nos: NosVoteFlowGemeenteJson;
  edges: readonly MappingEdgeLike[];
  statementKey: StatementKey;
  statementTitle: string;
}) {
  const [mode, setMode] = useState<Mode>("local_party_all");
  const [customHiddenWords, setCustomHiddenWords] = useState<string[]>(() => loadHiddenWords());
  const [precomputed, setPrecomputed] = useState<ExplanationWordStatsFile | null>(null);
  const [precomputedLoading, setPrecomputedLoading] = useState(false);
  const [precomputedError, setPrecomputedError] = useState<string | null>(null);

  const partyOptions = useMemo(() => sortPartiesBySeatWeight(bundle, nos, edges), [bundle, nos, edges]);
  const [selectedParty, setSelectedParty] = useState<string | null>(partyOptions[0]?.shortName ?? null);

  useEffect(() => {
    if (!partyOptions.some((party) => party.shortName === selectedParty)) {
      setSelectedParty(partyOptions[0]?.shortName ?? null);
    }
  }, [partyOptions, selectedParty]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HIDDEN_WORDS_STORAGE_KEY, JSON.stringify(customHiddenWords));
  }, [customHiddenWords]);

  useEffect(() => {
    if (!mode.startsWith("nationwide") || precomputed || precomputedLoading) return;

    let cancelled = false;
    setPrecomputedLoading(true);
    setPrecomputedError(null);

    void fetch(explanationWordStatsUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return normalizeExplanationWordStatsFile(
          (await response.json()) as ExplanationWordStatsFile,
        );
      })
      .then((data) => {
        if (!cancelled) setPrecomputed(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPrecomputedError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) setPrecomputedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, precomputed, precomputedLoading]);

  const builtInHiddenWords = useMemo(() => {
    const fromFile =
      precomputed?.defaults?.builtInUninterestingWords?.length
        ? precomputed.defaults.builtInUninterestingWords
        : BUILT_IN_UNINTERESTING_WORDS;
    return new Set(fromFile.map((word) => word.toLowerCase()));
  }, [precomputed]);

  const hiddenWords = useMemo(() => {
    const merged = new Set<string>(builtInHiddenWords);
    for (const word of customHiddenWords) merged.add(word.toLowerCase());
    return merged;
  }, [builtInHiddenWords, customHiddenWords]);

  const aggregate = useMemo(() => {
    if (mode === "nationwide_all") {
      return precomputed && precomputed.nationwideAll.explanationCount > 0
        ? precomputed.nationwideAll
        : null;
    }
    if (mode === "local_all_all") {
      return buildLiveBundleWordAggregate(bundle);
    }
    if (mode === "local_all_current") {
      return buildLiveBundleWordAggregate(bundle, statementKey);
    }
    if (!selectedParty) return null;
    if (mode === "nationwide_party") {
      return precomputed ? findNationwidePartyAggregate(precomputed, selectedParty) : null;
    }
    return buildLivePartyWordAggregate(
      bundle,
      selectedParty,
      mode === "local_party_current" ? statementKey : null,
    );
  }, [bundle, mode, precomputed, selectedParty, statementKey]);

  const visibleWords = useMemo(
    () => (aggregate ? filterExplanationWordStats(aggregate.words, hiddenWords).slice(0, VISIBLE_WORD_LIMIT) : []),
    [aggregate, hiddenWords],
  );

  const canSelectParty = ["local_party_all", "local_party_current", "nationwide_party"].includes(mode);

  function hideWord(word: string): void {
    const lower = word.toLowerCase();
    if (builtInHiddenWords.has(lower)) return;
    setCustomHiddenWords((current) =>
      current.includes(lower) ? current : [...current, lower].sort((a, b) => a.localeCompare(b, "nl")),
    );
  }

  function showWord(word: string): void {
    setCustomHiddenWords((current) => current.filter((candidate) => candidate !== word));
  }

  return (
    <section className="word-panel">
      <div className="word-panel-head">
        <div>
          <h3 className="word-panel-title">Woordbeeld in toelichtingen</h3>
          <p className="word-panel-copy">
            Meest voorkomende woorden in partijtoelichtingen. Landelijke tellingen zijn
            vooraf berekend; woorden verbergen gebeurt alleen in deze browser.
          </p>
        </div>
        {aggregate && (
          <div className="word-panel-meta">
            <strong>{aggregate.label}</strong>
            <span>{aggregateMetaLabel(mode, statementTitle)}</span>
            <span>
              {aggregate.explanationCount} toelichtingen · {aggregate.tokenCount} woordtreffers
            </span>
            {mode === "nationwide_party" || mode === "nationwide_all" ? (
              <span>{aggregate.municipalitiesCount} gemeenten</span>
            ) : null}
          </div>
        )}
      </div>

      <div className="word-panel-controls">
        <label className="word-panel-field">
          <span>Dataset</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="local_party_all">Deze partij · alle stellingen</option>
            <option value="local_party_current">Deze partij · huidige stelling</option>
            <option value="local_all_all">Alle partijen · deze gemeente · alle stellingen</option>
            <option value="local_all_current">Alle partijen · deze gemeente · huidige stelling</option>
            <option value="nationwide_party">Deze partijnaam · heel Nederland</option>
            <option value="nationwide_all">Alle partijen · heel Nederland</option>
          </select>
        </label>

        <label className="word-panel-field">
          <span>Partij</span>
          <select
            value={selectedParty ?? ""}
            disabled={!canSelectParty || partyOptions.length === 0}
            onChange={(event) => setSelectedParty(event.target.value || null)}
          >
            {partyOptions.map((party) => (
              <option key={party.shortName} value={party.shortName}>
                {party.shortName} {party.seats > 0 ? `(${party.seats})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {customHiddenWords.length > 0 && (
        <div className="word-panel-hidden">
          <span className="word-panel-hidden-label">Verborgen woorden</span>
          <div className="word-panel-hidden-list">
            {customHiddenWords.map((word) => (
              <button key={word} type="button" className="word-panel-chip" onClick={() => showWord(word)}>
                {word}
              </button>
            ))}
            <button
              type="button"
              className="word-panel-reset"
              onClick={() => setCustomHiddenWords([])}
            >
              Wis lijst
            </button>
          </div>
        </div>
      )}

      {!aggregate && (
        <p className="word-panel-empty">
          {precomputedLoading && (mode === "nationwide_party" || mode === "nationwide_all")
            ? "Landelijke woordlaag laden…"
            : precomputedError && (mode === "nationwide_party" || mode === "nationwide_all")
              ? `Landelijke woordlaag niet beschikbaar: ${precomputedError}`
              : mode === "nationwide_party" || mode === "nationwide_all"
                ? "Voor deze landelijke selectie zijn geen woorden gevonden."
            : "Voor deze selectie zijn geen toelichtingen met bruikbare woorden gevonden."}
        </p>
      )}

      {aggregate && visibleWords.length === 0 && (
        <p className="word-panel-empty">Na de huidige filters blijven geen woorden meer over.</p>
      )}

      {aggregate && visibleWords.length > 0 && (
        <div className="word-panel-table-wrap">
          <table className="word-panel-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Woord</th>
                <th>Keer</th>
                <th>Toelichtingen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleWords.map((row, index) => (
                <tr key={row.word}>
                  <td>{index + 1}</td>
                  <td className="word-panel-word">{row.word}</td>
                  <td>{row.occurrences}</td>
                  <td>{row.explanationCount}</td>
                  <td className="word-panel-actions">
                    <button type="button" className="word-panel-hide-btn" onClick={() => hideWord(row.word)}>
                      Oninteressant
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
