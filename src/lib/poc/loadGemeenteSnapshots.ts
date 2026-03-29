import { decodeStemwijzerPayload } from "../stembewijzer/decode";
import { normalizeStemwijzerBundle } from "../stembewijzer/normalize";
import type { StemwijzerCleanBundle } from "../stembewijzer/domain";
import type { NosVoteFlowGemeenteJson } from "../nosVoteFlow/raw";
import { toUitslagenCode } from "../stembewijzer/cbs";
import { POC_SNAPSHOT_DATE_DIR } from "./snapshotMetadata";

/**
 * Zelfde map als `npm run snapshot:nos-voteflow` / compare-parties.
 * `import.meta.glob` hieronder moet dezelfde datum als string literal bevatten (Vite).
 */
const stemwijzerGlob = import.meta.glob<string>(
  "../../../data/stemwijzer-snapshots/2026-03-25/GM*.json",
  { query: "?raw", import: "default" },
);

const nosGlob = import.meta.glob<{ default: NosVoteFlowGemeenteJson }>(
  "../../../data/nos-voteflow-snapshots/2026-03-25/G*.json",
);

function stemwijzerPath(gmCode: string): string {
  return `../../../data/stemwijzer-snapshots/${POC_SNAPSHOT_DATE_DIR}/${gmCode}.json`;
}

function nosPath(gmCode: string): string {
  const g = toUitslagenCode(gmCode);
  return `../../../data/nos-voteflow-snapshots/${POC_SNAPSHOT_DATE_DIR}/${g}.json`;
}

export async function loadStemwijzerBundle(gmCode: string): Promise<StemwijzerCleanBundle> {
  const p = stemwijzerPath(gmCode);
  const loader = stemwijzerGlob[p];
  if (!loader) throw new Error(`Geen StemWijzer-snapshot in build voor ${gmCode} (${p})`);
  const raw = (await loader()) as string;
  return normalizeStemwijzerBundle(decodeStemwijzerPayload(raw));
}

export async function loadNosGemeente(gmCode: string): Promise<NosVoteFlowGemeenteJson> {
  const p = nosPath(gmCode);
  const loader = nosGlob[p];
  if (!loader) throw new Error(`Geen NOS-snapshot in build voor ${gmCode} (${p})`);
  const mod = await loader();
  return mod.default;
}
