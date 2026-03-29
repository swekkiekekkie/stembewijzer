const SOURCES = ["StemWijzer", "NOS"] as const;

function formatSnapshotDate(snapshotDir: string): string {
  const parsed = new Date(`${snapshotDir}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return snapshotDir;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export const POC_SNAPSHOT_DATE_DIR = "2026-03-25";

export const POC_SNAPSHOT_META = {
  dateDir: POC_SNAPSHOT_DATE_DIR,
  dateLabel: formatSnapshotDate(POC_SNAPSHOT_DATE_DIR),
  /** Interne labels; publieke copy gebruikt generieke "tijdelijke externe zetelbron". */
  sources: SOURCES,
  sourcesLabel: "openbare StemWijzer-inhoud + externe zetelbron",
  majorityRuleLabel: "Meerderheid = meer dan de helft van de volledige raad.",
} as const;
