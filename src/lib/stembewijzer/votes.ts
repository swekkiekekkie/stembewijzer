import type { CleanParty, Position, StatementKey } from "./domain";

/** Signed axis: disagree = -1, neither = 0, agree = +1 */
export type PositionAxis = -1 | 0 | 1;

export type UserAnswers = Readonly<Partial<Record<StatementKey, Position>>>;

export interface PartyVoteCount {
  partyKey: string;
  votes: number;
}

export interface PartyVoteShare extends PartyVoteCount {
  /** 0–1 share of total valid votes. */
  share: number;
}

export interface SeatAllocation {
  partyKey: string;
  seats: number;
}

/**
 * Map each position to a single numeric axis (symmetric around 0).
 * Handy for dot products / correlation-style scores later.
 */
export function positionToAxis(p: Position): PositionAxis {
  if (p === "agree") return 1;
  if (p === "disagree") return -1;
  return 0;
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a === b;
}

/** How many statements both sides answered the same way. */
export function countMatchingPositions(
  answers: UserAnswers,
  party: CleanParty,
  keys: readonly StatementKey[],
): number {
  let n = 0;
  for (const k of keys) {
    const u = answers[k];
    const p = party.positions[k];
    if (u === undefined || p === undefined) continue;
    if (u === p) n += 1;
  }
  return n;
}

/** Hamming distance: number of compared statements where answers differ. */
export function hammingDistance(
  answers: UserAnswers,
  party: CleanParty,
  keys: readonly StatementKey[],
): number {
  let d = 0;
  let compared = 0;
  for (const k of keys) {
    const u = answers[k];
    const p = party.positions[k];
    if (u === undefined || p === undefined) continue;
    compared += 1;
    if (u !== p) d += 1;
  }
  return compared === 0 ? 0 : d;
}

/**
 * Simple agreement score: +1 same, 0 if either side missing, -1 different.
 * Sum over keys — correlates with “StemWijzer match %” style metrics if normalized.
 */
export function summedAgreementScore(
  answers: UserAnswers,
  party: CleanParty,
  keys: readonly StatementKey[],
): number {
  let score = 0;
  for (const k of keys) {
    const u = answers[k];
    const p = party.positions[k];
    if (u === undefined || p === undefined) continue;
    score += u === p ? 1 : -1;
  }
  return score;
}

/** Dot product on the {-1,0,1} axes (only keys where both sides have a position). */
export function axisDotProduct(
  answers: UserAnswers,
  party: CleanParty,
  keys: readonly StatementKey[],
): number {
  let s = 0;
  for (const k of keys) {
    const u = answers[k];
    const p = party.positions[k];
    if (u === undefined || p === undefined) continue;
    s += positionToAxis(u) * positionToAxis(p);
  }
  return s;
}

export function totalVotes(rows: readonly PartyVoteCount[]): number {
  let t = 0;
  for (const r of rows) t += Math.max(0, r.votes);
  return t;
}

/** Vote shares; rows with 0 total yield empty shares. */
export function voteShares(rows: readonly PartyVoteCount[]): PartyVoteShare[] {
  const total = totalVotes(rows);
  if (total <= 0) return rows.map((r) => ({ partyKey: r.partyKey, votes: r.votes, share: 0 }));
  return rows.map((r) => ({
    partyKey: r.partyKey,
    votes: r.votes,
    share: r.votes / total,
  }));
}

/**
 * Filter parties below a share threshold (e.g. Dutch list threshold 0.0067).
 * `threshold` is 0–1 on vote share.
 */
export function applyElectoralThreshold(
  rows: readonly PartyVoteCount[],
  threshold: number,
): PartyVoteCount[] {
  const shares = voteShares(rows);
  const keep = new Set<string>();
  for (const s of shares) {
    if (s.share >= threshold) keep.add(s.partyKey);
  }
  return rows.filter((r) => keep.has(r.partyKey));
}

/**
 * Largest remainder method (Hare quota) for integer seat allocation.
 * Deterministic tie-break: earlier row in input order wins extra seat.
 */
export function allocateSeatsLargestRemainder(
  rows: readonly PartyVoteCount[],
  seatCount: number,
): SeatAllocation[] {
  const total = totalVotes(rows);
  if (seatCount <= 0 || total <= 0) {
    return rows.map((r) => ({ partyKey: r.partyKey, seats: 0 }));
  }

  const quota = total / seatCount;
  const fractions: { partyKey: string; votes: number; base: number; remainder: number }[] = [];
  let assigned = 0;
  for (const r of rows) {
    const exact = r.votes / quota;
    const base = Math.floor(exact);
    const remainder = exact - base;
    fractions.push({ partyKey: r.partyKey, votes: r.votes, base, remainder });
    assigned += base;
  }

  let leftover = seatCount - assigned;
  const order = [...fractions].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return b.votes - a.votes;
  });

  const seatsMap = new Map<string, number>();
  for (const f of fractions) seatsMap.set(f.partyKey, f.base);
  for (let i = 0; i < order.length && leftover > 0; i++) {
    const k = order[i]!.partyKey;
    seatsMap.set(k, (seatsMap.get(k) ?? 0) + 1);
    leftover -= 1;
  }

  return rows.map((r) => ({ partyKey: r.partyKey, seats: seatsMap.get(r.partyKey) ?? 0 }));
}
