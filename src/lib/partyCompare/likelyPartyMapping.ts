/**
 * Likely StemWijzer ↔ NOS VoteFlow party mapping per gemeente.
 *
 * - Hamming distance is voor vaste lengte; hier gebruiken we genormaliseerde
 *   Levenshtein + substring-overlap op genormaliseerde labels.
 * - O(|SW|×|NOS|) per gemeente is klein (meestal < 30²); geen aparte
 *   index/heuristiek nodig om paren te *vergelijken*. Wel: greedy bipartiete
 *   matching op basis van score (geen volledige n³ Hungarian; kan later).
 *
 * **GL + PvdA lokaal niet gefuseerd (bijv. Nijmegen):** In sommige gemeenten
 * heeft de officiële uitslag nog **aparte** NOS-regels `GL` en `PVDA` (geen
 * `GLPVDA`). Dat is bewust zo: **niet** samenvoegen tot één fusielijst.
 * StemWijzer-partijen (bv. “GroenLinks Nijmegen” en “PvdA Nijmegen”) horen dan
 * **twee aparte kanten** naar die twee regels; stemweging op antwoorden moet
 * ook **twee gewichten** houden, geen gezamenlijke `GLPVDA`-bucket.
 */

import type { CleanParty } from "../stembewijzer/domain";
import type { NosVoteFlowPartijRij } from "../nosVoteFlow/raw";
import { PARTY_MAPPING_OVERRIDES } from "./partyMappingOverrides";

/** NOS `short_name` voor GroenLinks / PvdA in losse vorm (niet-fusie). */
const NOS_SHORT_GL = "GL";
const NOS_SHORT_PVDA = "PVDA";

/**
 * `true` als deze gemeente in VoteFlow **niet** als fusie `GLPVDA` uitstaat,
 * maar **los** GL en PvdA (zoals Nijmegen). Gebruik bij stemweging: geen
 * gezamenlijke weging tot één fusiepartij.
 */
export function nosHasSeparateGlAndPvda(nosRows: readonly NosVoteFlowPartijRij[]): boolean {
  let hasGl = false;
  let hasPvda = false;
  let hasFusion = false;
  for (const r of nosRows) {
    const s = r.partij.short_name;
    if (s === NOS_SHORT_GL) hasGl = true;
    if (s === NOS_SHORT_PVDA) hasPvda = true;
    if (s === "GLPVDA") hasFusion = true;
  }
  return hasGl && hasPvda && !hasFusion;
}

/** Genormaliseerd voor vergelijking: kleine letters, accenten weg, whitespace samengevouwen. */
export function normalizePartyLabel(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s_\-–—./]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}

/** Similariteit in [0, 1] op basis van genormaliseerde Levenshtein. */
export function stringSimilarityNormalized(a: string, b: string): number {
  const na = normalizePartyLabel(a);
  const nb = normalizePartyLabel(b);
  if (na.length === 0 && nb.length === 0) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 1;
  const d = levenshtein(na, nb);
  const denom = Math.max(na.length, nb.length);
  return Math.max(0, 1 - d / denom);
}

/** Als de ene genormaliseerde string de andere bevat (min lengte), boost voor lokale lijsten. */
function containmentBoost(longer: string, shorter: string): number {
  if (shorter.length < 4 || longer.length < 4) return 0;
  if (longer.includes(shorter)) return 0.88;
  return 0;
}

/** NOS-bucket: geen echte lijst, niet koppelen aan StemWijzer-partijen. */
export function isNosNonMatchableBucket(nos: NosVoteFlowPartijRij): boolean {
  const s = nos.partij.short_name.toUpperCase();
  if (s === "OVERIG") return true;
  const n = normalizePartyLabel(nos.partij.name);
  if (n.includes("niet langer deelnemende")) return true;
  return false;
}

export interface NosMappingContext {
  hasGlpvda: boolean;
  /** Los GL + PVDA (geen GLPVDA), o.a. Nijmegen — geen fusie-forceren. */
  separateGlAndPvda: boolean;
}

export function buildNosMappingContext(nosRows: readonly NosVoteFlowPartijRij[]): NosMappingContext {
  let hasGlpvda = false;
  for (const r of nosRows) {
    if (r.partij.short_name === "GLPVDA") hasGlpvda = true;
  }
  return {
    hasGlpvda,
    separateGlAndPvda: nosHasSeparateGlAndPvda(nosRows),
  };
}

/**
 * StemWijzer-naam ziet er uit als **fusie** GL+PvdA (één lijst), niet als “alleen GroenLinks [plaats]”.
 */
export function stemwijzerLooksLikeGlpvdaFusion(sw: CleanParty): boolean {
  const t = `${sw.shortName} ${sw.fullName}`.toLowerCase();
  if (/\bgroenlinks\s+nijmegen\b|\bpvda\s+nijmegen\b/.test(t)) return false;
  const patterns: RegExp[] = [
    /\bgroen\s*links\s*[-/\s]+\s*pvd\b/,
    /\bpvd[a\s]*[-/\s]+groen\s*links\b/,
    /\bgl[\s\-/]+pvd\b/,
    /\bpvd[\s\-/]+gl\b/,
    /\bgroenlinks\s*\/\s*pvd\b/,
    /\bpvd\s*\/\s*groenlinks\b/,
    /groenlinks.*partij van de arbeid/,
    /partij van de arbeid.*groenlinks/,
    /\bgroenlinks\s*-\s*pvd\b/,
    /\bpvd\s*-\s*groenlinks\b/,
    /\bgroenlinks-pvda\b/,
    /\bpvda-groenlinks\b/,
  ];
  return patterns.some((p) => p.test(t));
}

function isNosPvdaOnlyRow(nos: NosVoteFlowPartijRij): boolean {
  if (nos.partij.short_name !== "PVDA") return false;
  const nl = normalizePartyLabel(nos.partij.name);
  return !nl.includes("groenlinks") && !nl.includes("groen links");
}

function nationalLocalListBoost(sw: CleanParty, nos: NosVoteFlowPartijRij, base: number): number {
  const nShort = nos.partij.short_name;
  const s = sw.shortName.trim();
  const upper = /^([A-Za-z0-9]+)(\s+|$)/.exec(s);
  if (!upper) return base;
  const first = upper[1]!;
  if (first.toUpperCase() === nShort.toUpperCase()) return Math.max(base, 0.94);
  const national = [
    "D66",
    "VVD",
    "CDA",
    "PVV",
    "SP",
    "SGP",
    "CU",
    "PvdD",
    "PVDD",
    "FvD",
    "FVD",
    "50PLUS",
    "BBB",
    "Volt",
    "VOLT",
    "DENK",
    "Denk",
  ];
  for (const p of national) {
    if (p.toUpperCase() !== nShort.toUpperCase()) continue;
    if (s.toUpperCase().startsWith(p.toUpperCase() + " ") || s.toUpperCase() === p.toUpperCase()) {
      return Math.max(base, 0.94);
    }
  }
  return base;
}

/**
 * Uitgebreide schrijfwijzen (voluit CDA/VVD), blanco-lijsten, lokale acroniemen.
 */
function expansionAliasAndBlancoBoost(sw: CleanParty, nos: NosVoteFlowPartijRij, base: number): number {
  const n = nos.partij.short_name;
  const nUp = n.toUpperCase();
  const bundle = `${sw.shortName} ${sw.fullName}`;
  const nl = normalizePartyLabel(bundle);

  let b = base;

  if (n === "CDA") {
    if (nl.includes("christen democratisch") || /\bcda\b/.test(nl)) b = Math.max(b, 0.94);
  }
  if (n === "VVD") {
    if (nl.includes("volkspartij voor vrijheid") || /\bvvd\b/.test(nl)) b = Math.max(b, 0.94);
  }
  if (n === "PVV" && nl.includes("partij voor de vrijheid")) b = Math.max(b, 0.93);
  if (n === "BBB" && (nl.includes("boer burger") || nl.includes("boerburger") || nl.includes("burger beweging")))
    b = Math.max(b, 0.93);
  if (n === "BVNL" && nl.includes("belang van nederland")) b = Math.max(b, 0.93);
  if (n === "BBBPEE" && nl.includes("boer") && nl.includes("bbb")) b = Math.max(b, 0.9);

  if (nUp.startsWith("BLANCO") || nUp === "BLANCO") {
    if (/blanco|lijst\s*\d+|lijst\s+[a-z]/i.test(bundle) || /recht\s+door\s+zee/i.test(nl)) {
      b = Math.max(b, 0.93);
    }
    /** Alleen als StemWijzer ook echt een blanco/lijst is — niet elke partij vs de blanco-rij. */
    if (nUp === "BLANCO" && /blanco/i.test(nos.partij.name) && /blanco|lijst\s*\d|lijst\s+[a-z]/i.test(bundle)) {
      b = Math.max(b, 0.9);
    }
    if (/muiderberg|meijer/i.test(bundle) && /blanco/i.test(nos.partij.name)) b = Math.max(b, 0.88);
  }

  if (n === "CUSGP" && nl.includes("cu") && nl.includes("sgp")) b = Math.max(b, 0.9);
  if (n === "CDACU" && nl.includes("cda") && (nl.includes("cu") || nl.includes("christenunie"))) b = Math.max(b, 0.93);

  if (n === "GEMBEL" && nl.includes("gemeentebelang")) b = Math.max(b, 0.88);

  if (n === "BOP1" && nl.includes("burger") && /1|een/.test(sw.shortName)) b = Math.max(b, 0.9);

  if (n === "BAR" && nl.includes("armoede")) b = Math.max(b, 0.9);

  if (n === "WIJ" && nl.startsWith("wij")) b = Math.max(b, 0.93);

  if (n === "IPL" && nl.includes("inwoners")) b = Math.max(b, 0.93);

  if (n === "LSH" && nl.includes("lokaal") && nl.includes("sh")) b = Math.max(b, 0.88);

  if (n === "SDS" && nl.includes("sociaal") && nl.includes("duurzaam")) b = Math.max(b, 0.88);

  if (n === "HG" && nl.includes("helder") && nl.includes("gedreven")) b = Math.max(b, 0.9);

  if (n === "ABT" && nl.includes("algemeen belang")) b = Math.max(b, 0.9);

  if (n === "VPB" && /vp|baarle|vooruitstrevende/i.test(bundle)) b = Math.max(b, 0.9);

  if (n === "BSD" && (nl.includes("bsd") || nl.includes("bergse") || nl.includes("sociaal democrat"))) b = Math.max(b, 0.88);

  if (n === "ECHVOO" && /\bevv\b/i.test(sw.shortName)) b = Math.max(b, 0.9);

  if (n === "RGL" && nl.includes("rijn") && nl.includes("gouwe")) b = Math.max(b, 0.88);

  if (n === "HOOOPE" && nl.includes("hoorn") && (nl.includes("open") || nl.includes("eerlijk"))) b = Math.max(b, 0.88);

  if (n === "LIJMAR" && /verspeek/i.test(bundle)) b = Math.max(b, 0.9);

  if (n === "VDDOES" && /van der does|does/i.test(bundle)) b = Math.max(b, 0.9);

  if (n === "LIJMET" && /lijst\s*11|lijst 11/i.test(bundle)) b = Math.max(b, 0.9);

  if (n === "PAGLPVDA" && (nl.includes("pgp") || nl.includes("deurne"))) b = Math.max(b, 0.88);

  if (n === "PROWGL" && nl.includes("groenlinks") && nl.includes("pvda")) b = Math.max(b, 0.88);

  if (n === "DSW" && (nl.includes("dsw") || (nl.includes("duurzaam") && nl.includes("sterk")))) b = Math.max(b, 0.88);

  if (n === "BLANCOCE" && /cete|çete/i.test(bundle)) b = Math.max(b, 0.88);

  if (n === "BLANCOTW" && /ten\s*wolde|blanco/i.test(bundle)) b = Math.max(b, 0.88);

  if (n === "BLANCOZW" || n === "BLANCOWA") {
    if (/blanco|lijst\s*20|lijst\s*18|horizons|link/i.test(bundle)) b = Math.max(b, 0.88);
  }

  if (n === "BLANCOF" && /blanco|lijst\s*9|fiscalini/i.test(bundle)) b = Math.max(b, 0.88);

  return Math.min(1, b);
}

function scorePartyPairBase(sw: CleanParty, nos: NosVoteFlowPartijRij): number {
  const sShort = sw.shortName;
  const sFull = sw.fullName;
  const nShort = nos.partij.short_name;
  const nLong = nos.partij.name;

  const pairs: [string, string][] = [
    [sShort, nShort],
    [sShort, nLong],
    [sFull, nShort],
    [sFull, nLong],
  ];

  let best = 0;
  for (const [a, b] of pairs) {
    const sim = stringSimilarityNormalized(a, b);
    const na = normalizePartyLabel(a);
    const nb = normalizePartyLabel(b);
    const longer = na.length >= nb.length ? na : nb;
    const shorter = na.length >= nb.length ? nb : na;
    const boost = containmentBoost(longer, shorter);
    best = Math.max(best, sim, boost);
  }
  return Math.min(1, best);
}

/**
 * Score met context: blokkeert OVERIG, voorkomt fusie-lijst → alleen-PVDA als GLPVDA bestaat,
 * boost lokale nationale lijsten (D66 Utrecht → D66).
 */
export function scorePartyPair(
  sw: CleanParty,
  nos: NosVoteFlowPartijRij,
  ctx: NosMappingContext,
): number {
  if (isNosNonMatchableBucket(nos)) return 0;

  let base = scorePartyPairBase(sw, nos);
  base = nationalLocalListBoost(sw, nos, base);
  base = expansionAliasAndBlancoBoost(sw, nos, base);

  if (
    stemwijzerLooksLikeGlpvdaFusion(sw) &&
    ctx.hasGlpvda &&
    !ctx.separateGlAndPvda &&
    isNosPvdaOnlyRow(nos)
  ) {
    return 0;
  }

  if (nos.partij.short_name === "GLPVDA" && stemwijzerLooksLikeGlpvdaFusion(sw)) {
    base = Math.max(base, 0.92);
  }

  return Math.min(1, base);
}

export interface LikelyPartyMappingEdge {
  stemwijzerShortName: string;
  stemwijzerFullName: string;
  nosShortName: string;
  nosFullName: string;
  /** 0–1, interpretatie: sterk > ~0.85, twijfel 0.5–0.85, zwak < 0.5 */
  score: number;
}

export interface LikelyPartyMappingResult {
  gmCode: string;
  edges: LikelyPartyMappingEdge[];
  unmatchedStemwijzer: string[];
  unmatchedNos: string[];
  /** Gemiddelde score over gelegde kanten (alleen gematcht). */
  meanScoreMatched: number | null;
}

/**
 * Greedy: sorteer alle kandidaat-kanten op score, wijs disjunct toe.
 * Werkt bij |SW| ≠ |NOS|: resterende namen gaan naar unmatched.
 */
function applyManualOverrides(
  gmCode: string,
  edges: LikelyPartyMappingEdge[],
  nosRows: readonly NosVoteFlowPartijRij[],
): void {
  const relevant = PARTY_MAPPING_OVERRIDES.filter((o) => o.gmCode === gmCode);
  if (relevant.length === 0) return;

  const nosMeta = new Map(nosRows.map((r) => [r.partij.short_name, r.partij] as const));

  for (const o of relevant) {
    const eWant = edges.find((e) => e.stemwijzerShortName === o.stemwijzerShortName);
    if (!eWant || eWant.nosShortName === o.nosShortName) continue;

    const target = nosMeta.get(o.nosShortName);
    if (!target) continue;

    const eOther = edges.find(
      (e) => e.nosShortName === o.nosShortName && e.stemwijzerShortName !== o.stemwijzerShortName,
    );

    if (eOther) {
      const wShort = eWant.nosShortName;
      const wFull = eWant.nosFullName;
      const metaWrong = nosMeta.get(wShort);
      eWant.nosShortName = eOther.nosShortName;
      eWant.nosFullName = eOther.nosFullName;
      eWant.score = 1;
      eOther.nosShortName = wShort;
      eOther.nosFullName = metaWrong ? metaWrong.name : wFull;
      eOther.score = Math.max(eOther.score, 0.85);
    } else {
      eWant.nosShortName = target.short_name;
      eWant.nosFullName = target.name;
      eWant.score = 1;
    }
  }
}

export function buildLikelyPartyMapping(
  parties: readonly CleanParty[],
  nosRows: readonly NosVoteFlowPartijRij[],
  gmCode: string,
): LikelyPartyMappingResult {
  const ctx = buildNosMappingContext(nosRows);

  type Cand = { i: number; j: number; score: number };
  const cands: Cand[] = [];
  for (let i = 0; i < parties.length; i++) {
    for (let j = 0; j < nosRows.length; j++) {
      const score = scorePartyPair(parties[i]!, nosRows[j]!, ctx);
      cands.push({ i, j, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);

  const usedI = new Set<number>();
  const usedJ = new Set<number>();
  const edges: LikelyPartyMappingEdge[] = [];

  for (const c of cands) {
    if (usedI.has(c.i) || usedJ.has(c.j)) continue;
    usedI.add(c.i);
    usedJ.add(c.j);
    const sw = parties[c.i]!;
    const nos = nosRows[c.j]!;
    edges.push({
      stemwijzerShortName: sw.shortName,
      stemwijzerFullName: sw.fullName,
      nosShortName: nos.partij.short_name,
      nosFullName: nos.partij.name,
      score: c.score,
    });
  }

  applyManualOverrides(gmCode, edges, nosRows);

  const matchedSw = new Set(edges.map((e) => e.stemwijzerShortName));
  const matchedNos = new Set(edges.map((e) => e.nosShortName));

  const unmatchedStemwijzer: string[] = [];
  for (const p of parties) {
    if (!matchedSw.has(p.shortName)) unmatchedStemwijzer.push(p.shortName);
  }
  const unmatchedNos: string[] = [];
  for (const r of nosRows) {
    const sn = r.partij.short_name;
    if (!matchedNos.has(sn)) unmatchedNos.push(sn);
  }

  unmatchedStemwijzer.sort((a, b) => a.localeCompare(b));
  unmatchedNos.sort((a, b) => a.localeCompare(b));

  const meanScoreMatched =
    edges.length === 0 ? null : edges.reduce((s, e) => s + e.score, 0) / edges.length;

  return {
    gmCode,
    edges,
    unmatchedStemwijzer,
    unmatchedNos,
    meanScoreMatched,
  };
}

/** Drempel voor “waarschijnlijk goed” (rapportage). */
export const LIKELY_STRONG_SCORE = 0.85;
export const LIKELY_WEAK_SCORE = 0.5;
