import type {
  StemwijzerRawBundle,
  StemwijzerRawParty,
  StemwijzerRawStatement,
  StemwijzerRawWireString,
} from "./raw";
import type {
  CleanElectionMeta,
  CleanParty,
  CleanStatement,
  PartyKey,
  Position,
  StatementKey,
  StemwijzerCleanBundle,
} from "./domain";

export function statementKey(themeId: string, index: number): StatementKey {
  return `${themeId}:${index}`;
}

/** Derive a URL-safe party key from the short name (e.g. `CDA` → `cda`). */
export function partyKeyFromName(shortName: string): PartyKey {
  return shortName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Wire-copy naar één doorlopende string.
 * Ondersteunt: `string`, `{ text | information | accessibility.* }`, en **arrays** van fragmenten
 * (typisch stellingtitels met woordenlijst-termen).
 */
export function wireStringToPlain(v: StemwijzerRawWireString | undefined | null): string {
  return wireCopyToPlain(v as unknown);
}

function wireCopyToPlain(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(wireCopyToPlain).join("");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const text = o.text;
    const info = o.information;
    if (typeof text === "string" && text.length > 0) return text;
    if (typeof info === "string" && info.length > 0) return info;
    const acc = o.accessibility;
    if (acc && typeof acc === "object") {
      const a = acc as Record<string, unknown>;
      if (typeof a.information === "string" && a.information.length > 0) return a.information;
      if (typeof a.explanation === "string" && a.explanation.length > 0) return a.explanation;
    }
    if (typeof text === "string") return text;
  }
  return "";
}

function normalizeStatementList(raw: StemwijzerRawStatement[], shootout: boolean): CleanStatement[] {
  const out: CleanStatement[] = [];
  for (const s of raw) {
    out.push({
      key: statementKey(s.themeId, s.index),
      theme: wireStringToPlain(s.theme),
      themeId: s.themeId,
      title: wireStringToPlain(s.title),
      orderIndex: s.index,
      isShootout: shootout || s.isShootout,
    });
  }
  return out;
}

function buildStatementIdToKey(bundle: StemwijzerRawBundle): Map<number, StatementKey> {
  const map = new Map<number, StatementKey>();
  const add = (list: StemwijzerRawStatement[]) => {
    for (const s of list) {
      map.set(s.id, statementKey(s.themeId, s.index));
    }
  };
  add(bundle.statements);
  add(bundle.shootoutStatements);
  return map;
}

function indexStatementsByKey(list: CleanStatement[]): Map<StatementKey, CleanStatement> {
  const m = new Map<StatementKey, CleanStatement>();
  for (const s of list) m.set(s.key, s);
  return m;
}

function normalizeParty(
  raw: StemwijzerRawParty,
  statementIndex: Map<StatementKey, CleanStatement>,
  idToKey: Map<number, StatementKey>,
): CleanParty {
  const key = partyKeyFromName(raw.name);
  const positions: Record<StatementKey, Position> = {};
  const explanations: Partial<Record<StatementKey, string>> = {};

  for (const ps of raw.statements) {
    const sk = idToKey.get(ps.id);
    if (!sk) continue;
    if (!statementIndex.has(sk)) continue;
    positions[sk] = ps.position;
    explanations[sk] = wireStringToPlain(ps.explanation);
  }

  return {
    key,
    shortName: raw.name,
    fullName: raw.fullName,
    logoAsset: raw.logo,
    website: raw.website?.trim() ? raw.website : null,
    participates: raw.participates,
    hasSeats: raw.hasSeats,
    positions,
    explanations,
  };
}

function metaFromRaw(bundle: StemwijzerRawBundle): CleanElectionMeta {
  const v = bundle.votematch;
  return {
    votematchNumericId: v.id,
    label: wireStringToPlain(v.name),
    context: v.context,
    date: v.date,
    remoteId: v.remote_id,
    langcode: v.langcode,
  };
}

/**
 * Strip upstream ids and align parties to statements via stable `StatementKey`s.
 */
export function normalizeStemwijzerBundle(raw: StemwijzerRawBundle): StemwijzerCleanBundle {
  const statements = normalizeStatementList(raw.statements, false);
  const shootoutStatements = normalizeStatementList(raw.shootoutStatements, true);
  const statementIndex = indexStatementsByKey([...statements, ...shootoutStatements]);
  const idToKey = buildStatementIdToKey(raw);

  const parties = raw.parties.map((p) => normalizeParty(p, statementIndex, idToKey));

  return {
    meta: metaFromRaw(raw),
    statements,
    shootoutStatements,
    parties,
  };
}

/** Ordered statement keys as they appear in `statements` (useful for matrices / vectors). */
export function statementKeysInOrder(bundle: StemwijzerCleanBundle): StatementKey[] {
  return bundle.statements.map((s) => s.key);
}
