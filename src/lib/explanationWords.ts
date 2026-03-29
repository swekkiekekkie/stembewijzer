import type { StatementKey, StemwijzerCleanBundle } from "./stembewijzer/domain";
import { partyKeyFromName } from "./stembewijzer/normalize";

export const EXPLANATION_WORD_MIN_LENGTH = 3;

export const BUILT_IN_UNINTERESTING_WORDS = [
  "aan",
  "als",
  "bij",
  "dan",
  "dat",
  "de",
  "den",
  "der",
  "des",
  "deze",
  "die",
  "dit",
  "door",
  "een",
  "en",
  "er",
  "het",
  "hun",
  "in",
  "is",
  "met",
  "naar",
  "niet",
  "nog",
  "ons",
  "onze",
  "ook",
  "over",
  "tot",
  "uit",
  "van",
  "voor",
  "wat",
  "wel",
  "wij",
  "wordt",
  "zijn",
  "zo",
  "zou",
].sort((a, b) => a.localeCompare(b));

export interface ExplanationWordStat {
  word: string;
  occurrences: number;
  explanationCount: number;
}

export type ExplanationWordStatTuple = [
  word: string,
  occurrences: number,
  explanationCount: number,
];

export interface ExplanationWordAggregate {
  key: string;
  label: string;
  explanationCount: number;
  tokenCount: number;
  municipalitiesCount: number;
  partyEntriesCount: number;
  words: ExplanationWordStatTuple[];
}

export interface ExplanationWordStatsFile {
  generatedAt: string;
  snapshotDir: string;
  defaults: {
    minWordLength: number;
    builtInUninterestingWords: string[];
  };
  totals: {
    municipalities: number;
    partyEntries: number;
    explanations: number;
    uniquePartyKeys: number;
  };
  nationwideAll: ExplanationWordAggregate;
  nationwideByPartyKey: ExplanationWordAggregate[];
}

type MutableWordCounter = {
  occurrences: number;
  explanationCount: number;
};

type MutableAggregate = {
  key: string;
  label: string;
  explanationCount: number;
  tokenCount: number;
  municipalities: Set<string>;
  partyEntriesCount: number;
  words: Map<string, MutableWordCounter>;
};

function normalizeToken(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function tokenizeExplanationText(text: string): string[] {
  return text
    .split(/[^0-9A-Za-zÀ-ÿ]+/g)
    .map(normalizeToken)
    .filter((token) => token.length >= EXPLANATION_WORD_MIN_LENGTH)
    .filter((token) => !/^\d+$/.test(token));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toExplanationWordTuple(parts: readonly unknown[]): ExplanationWordStatTuple | null {
  const [word, occurrences, explanationCount] = parts;
  if (typeof word !== "string") return null;
  if (!isFiniteNumber(occurrences) || !isFiniteNumber(explanationCount)) return null;
  return [word, occurrences, explanationCount];
}

export function normalizeExplanationWordStatTuples(
  words: readonly unknown[] | null | undefined,
): ExplanationWordStatTuple[] {
  if (!words || words.length === 0) return [];

  if (words.some((entry) => Array.isArray(entry))) {
    return words
      .map((entry) => (Array.isArray(entry) ? toExplanationWordTuple(entry) : null))
      .filter((entry): entry is ExplanationWordStatTuple => entry !== null);
  }

  const tuples: ExplanationWordStatTuple[] = [];
  for (let index = 0; index + 2 < words.length; index += 3) {
    const tuple = toExplanationWordTuple([words[index], words[index + 1], words[index + 2]]);
    if (tuple) tuples.push(tuple);
  }
  return tuples;
}

export function createExplanationWordAggregateBuilder(key: string, label: string): MutableAggregate {
  return {
    key,
    label,
    explanationCount: 0,
    tokenCount: 0,
    municipalities: new Set<string>(),
    partyEntriesCount: 0,
    words: new Map<string, MutableWordCounter>(),
  };
}

function hydrateWordCounter(counter: MutableWordCounter | undefined): MutableWordCounter {
  if (counter) return counter;
  return { occurrences: 0, explanationCount: 0 };
}

export function collectExplanationTexts(
  bundle: StemwijzerCleanBundle,
  partyShortName: string,
  statementKey?: StatementKey | null,
): string[] {
  const party = bundle.parties.find((candidate) => candidate.shortName === partyShortName);
  if (!party) return [];

  if (statementKey) {
    const single = party.explanations[statementKey]?.trim();
    return single ? [single] : [];
  }

  return Object.values(party.explanations)
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

export function accumulateTextsIntoAggregate(
  aggregate: MutableAggregate,
  texts: readonly string[],
  gemeenteKey?: string,
  partyEntryCount = 0,
): void {
  if (gemeenteKey) aggregate.municipalities.add(gemeenteKey);
  aggregate.partyEntriesCount += partyEntryCount;

  for (const text of texts) {
    const tokens = tokenizeExplanationText(text);
    if (tokens.length === 0) continue;
    aggregate.explanationCount += 1;
    aggregate.tokenCount += tokens.length;

    const seenInExplanation = new Set<string>();
    for (const token of tokens) {
      const current = hydrateWordCounter(aggregate.words.get(token));
      current.occurrences += 1;
      if (!seenInExplanation.has(token)) {
        current.explanationCount += 1;
        seenInExplanation.add(token);
      }
      aggregate.words.set(token, current);
    }
  }
}

export function finalizeExplanationWordAggregate(aggregate: MutableAggregate): ExplanationWordAggregate {
  const words: ExplanationWordStatTuple[] = [...aggregate.words.entries()]
    .map(([word, counter]): ExplanationWordStatTuple => [word, counter.occurrences, counter.explanationCount])
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      if (right[2] !== left[2]) return right[2] - left[2];
      return left[0].localeCompare(right[0], "nl");
    });

  return {
    key: aggregate.key,
    label: aggregate.label,
    explanationCount: aggregate.explanationCount,
    tokenCount: aggregate.tokenCount,
    municipalitiesCount: aggregate.municipalities.size,
    partyEntriesCount: aggregate.partyEntriesCount,
    words,
  };
}

export function normalizeExplanationWordAggregate(
  aggregate: ExplanationWordAggregate,
): ExplanationWordAggregate {
  return {
    ...aggregate,
    words: normalizeExplanationWordStatTuples(aggregate.words as unknown[]),
  };
}

export function normalizeExplanationWordStatsFile(
  file: ExplanationWordStatsFile,
): ExplanationWordStatsFile {
  return {
    ...file,
    nationwideAll: normalizeExplanationWordAggregate(file.nationwideAll),
    nationwideByPartyKey: file.nationwideByPartyKey.map((aggregate) =>
      normalizeExplanationWordAggregate(aggregate),
    ),
  };
}

export function buildLivePartyWordAggregate(
  bundle: StemwijzerCleanBundle,
  partyShortName: string,
  statementKey?: StatementKey | null,
): ExplanationWordAggregate | null {
  const texts = collectExplanationTexts(bundle, partyShortName, statementKey);
  if (texts.length === 0) return null;

  const aggregate = createExplanationWordAggregateBuilder(
    partyKeyFromName(partyShortName),
    partyShortName,
  );
  accumulateTextsIntoAggregate(aggregate, texts, bundle.meta.remoteId, 1);
  return finalizeExplanationWordAggregate(aggregate);
}

export function buildLiveBundleWordAggregate(
  bundle: StemwijzerCleanBundle,
  statementKey?: StatementKey | null,
): ExplanationWordAggregate | null {
  const aggregate = createExplanationWordAggregateBuilder("alle-partijen", "Alle partijen");
  let partyEntryCount = 0;

  for (const party of bundle.parties) {
    const texts = collectExplanationTexts(bundle, party.shortName, statementKey);
    if (texts.length === 0) continue;
    partyEntryCount += 1;
    accumulateTextsIntoAggregate(aggregate, texts, bundle.meta.remoteId, 1);
  }

  if (partyEntryCount === 0 || aggregate.explanationCount === 0) return null;
  return finalizeExplanationWordAggregate(aggregate);
}

export function findNationwidePartyAggregate(
  file: ExplanationWordStatsFile,
  partyShortName: string,
): ExplanationWordAggregate | null {
  const key = partyKeyFromName(partyShortName);
  return file.nationwideByPartyKey.find((aggregate) => aggregate.key === key) ?? null;
}

export function filterExplanationWordStats(
  stats: readonly ExplanationWordStatTuple[] | readonly unknown[],
  hiddenWords: ReadonlySet<string>,
): ExplanationWordStat[] {
  return normalizeExplanationWordStatTuples(stats)
    .filter(([word]) => !hiddenWords.has(word))
    .map(([word, occurrences, explanationCount]) => ({
      word,
      occurrences,
      explanationCount,
    }));
}
