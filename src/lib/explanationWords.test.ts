import { describe, expect, it } from "vitest";

import {
  buildLivePartyWordAggregate,
  filterExplanationWordStats,
  findNationwidePartyAggregate,
  normalizeExplanationWordStatsFile,
  tokenizeExplanationText,
  type ExplanationWordStatsFile,
} from "@/lib/explanationWords";
import { testBundle, testStatementA } from "@/test/pocFixtures";

describe("explanationWords", () => {
  it("tokenizes explanation text into normalized searchable words", () => {
    expect(tokenizeExplanationText("Méér woningen, in 2026! Voor starters.")).toEqual([
      "meer",
      "woningen",
      "voor",
      "starters",
    ]);
  });

  it("builds live party aggregates from all explanations", () => {
    const aggregate = buildLivePartyWordAggregate(testBundle, "Samen");
    expect(aggregate).not.toBeNull();
    expect(aggregate?.explanationCount).toBe(2);
    expect(aggregate?.words.some(([word]) => word === "bouwen")).toBe(true);
    expect(aggregate?.words.some(([word]) => word === "centrum")).toBe(true);
  });

  it("can scope a live aggregate to the current statement", () => {
    const aggregate = buildLivePartyWordAggregate(testBundle, "Samen", testStatementA);
    expect(aggregate?.explanationCount).toBe(1);
    expect(aggregate?.words.some(([word]) => word === "bouwen")).toBe(true);
    expect(aggregate?.words.some(([word]) => word === "centrum")).toBe(false);
  });

  it("filters hidden words out of visible stats", () => {
    const filtered = filterExplanationWordStats(
      [
        ["bouwen", 3, 2],
        ["centrum", 2, 1],
      ],
      new Set(["centrum"]),
    );
    expect(filtered).toEqual([{ word: "bouwen", occurrences: 3, explanationCount: 2 }]);
  });

  it("finds a nationwide aggregate by party label", () => {
    const file: ExplanationWordStatsFile = {
      generatedAt: "",
      snapshotDir: "",
      defaults: { minWordLength: 3, builtInUninterestingWords: [] },
      totals: { municipalities: 0, partyEntries: 0, explanations: 0, uniquePartyKeys: 1 },
      nationwideAll: {
        key: "nederland",
        label: "Alle partijen",
        explanationCount: 0,
        tokenCount: 0,
        municipalitiesCount: 0,
        partyEntriesCount: 0,
        words: [],
      },
      nationwideByPartyKey: [
        {
          key: "samen",
          label: "Samen",
          explanationCount: 2,
          tokenCount: 8,
          municipalitiesCount: 1,
          partyEntriesCount: 1,
          words: [["bouwen", 3, 2]],
        },
      ],
    };

    expect(findNationwidePartyAggregate(file, "Samen")?.label).toBe("Samen");
  });

  it("normalizes flattened word arrays from precomputed json", () => {
    const file = normalizeExplanationWordStatsFile({
      generatedAt: "",
      snapshotDir: "",
      defaults: { minWordLength: 3, builtInUninterestingWords: [] },
      totals: { municipalities: 0, partyEntries: 0, explanations: 0, uniquePartyKeys: 0 },
      nationwideAll: {
        key: "nederland",
        label: "Alle partijen",
        explanationCount: 2,
        tokenCount: 5,
        municipalitiesCount: 1,
        partyEntriesCount: 1,
        words: ["bouwen", 3, 2, "wonen", 2, 1] as unknown as ExplanationWordStatsFile["nationwideAll"]["words"],
      },
      nationwideByPartyKey: [],
    });

    expect(file.nationwideAll.words).toEqual([
      ["bouwen", 3, 2],
      ["wonen", 2, 1],
    ]);
  });
});
