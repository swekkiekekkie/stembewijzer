import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { POC_SNAPSHOT_META } from "@/lib/poc/snapshotMetadata";
import { buildGemeentePocIndex, type GemeentePocOption } from "@/lib/poc/gemeentePocIndex";
import {
  computeQuestionZetelDistribution,
  councilMajorityCategory,
  totalRaadFromNos,
  type QuestionZetelResult,
  type ZetelSegment,
} from "@/lib/poc/pocQuestionZetels";
import { loadNosGemeente, loadStemwijzerBundle } from "@/lib/poc/loadGemeenteSnapshots";
import type { NosVoteFlowGemeenteJson } from "@/lib/nosVoteFlow/raw";
import type { StatementKey, StemwijzerCleanBundle } from "@/lib/stembewijzer/domain";
import { statementKeysInOrder } from "@/lib/stembewijzer/normalize";

import CoalitionAnalysisPanel from "./CoalitionAnalysisPanel";
// import ExplanationWordPanel from "./ExplanationWordPanel";
import GemeenteAutocomplete from "./GemeenteAutocomplete";
import {
  buildRaadCoverageSummary,
  formatSeatShare,
  humanizeGemeenteLoadError,
  readPocFlowQuery,
  replacePocFlowQuery,
} from "./pocFlowViewModel";

import "./PocFlow.css";

const GEMEENTEN = buildGemeentePocIndex().sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

type StatementWithMajoritySeatPct = {
  key: StatementKey;
  winZetels: number;
  totalRaad: number;
};

type SegmentDetail = {
  stemwijzerShortName: string;
  zetels: number;
  side: "ja" | "nee";
  explanation: string | null;
};

function zetelShadeJa(zetels: number, minZ: number, maxZ: number): string {
  if (maxZ <= 0) return "hsl(145 72% 42%)";
  const span = maxZ - minZ;
  const t = span <= 0 ? 1 : (zetels - minZ) / span;
  const lightness = 24 + t * 32;
  const saturation = 54 + t * 34;
  return `hsl(145 ${Math.round(saturation)}% ${Math.round(lightness)}%)`;
}

function zetelShadeNee(zetels: number, minZ: number, maxZ: number): string {
  if (maxZ <= 0) return "hsl(0 82% 44%)";
  const span = maxZ - minZ;
  const t = span <= 0 ? 1 : (zetels - minZ) / span;
  const lightness = 24 + t * 32;
  const saturation = 76 + t * 20;
  return `hsl(0 ${Math.round(saturation)}% ${Math.round(lightness)}%)`;
}

function majoritySummaryPlainText(total: number, ja: number, nee: number): string {
  if (total <= 0) return "Geen raadszetels bekend.";
  const half = total / 2;
  if (ja > half) return "Meerderheid voor";
  if (nee > half) return "Meerderheid tegen";
  return "Geen meerderheid";
}

function majorityLabel(total: number, ja: number, nee: number): ReactNode {
  if (total <= 0) return "Geen raadszetels bekend.";
  const half = total / 2;
  if (ja > half) return <span>Meerderheid <u>voor</u></span>;
  if (nee > half) return <span>Meerderheid <u>tegen</u></span>;
  return <span><u>Geen</u> meerderheid</span>;
}

function partyExplanationText(
  bundle: StemwijzerCleanBundle,
  shortName: string,
  statementKey: StatementKey,
): string | null {
  const party = bundle.parties.find((candidate) => candidate.shortName === shortName);
  const explanation = party?.explanations[statementKey]?.trim();
  return explanation && explanation.length > 0 ? explanation : null;
}

function statementTitle(bundle: StemwijzerCleanBundle, key: StatementKey): string {
  return bundle.statements.find((statement) => statement.key === key)?.title ?? key;
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: "loading" | "error";
  title: string;
  body: string;
}) {
  return (
    <section className={`poc-flow-status-card poc-flow-status-card--${tone}`}>
      <h2 className="poc-flow-status-title">{title}</h2>
      <p className="poc-flow-status-body">{body}</p>
    </section>
  );
}

function ExternalDocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="poc-flow-ext-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const LEGAL_CONTEXT_REGION_ID = "legal-context";

function openLegalContextProjectPanel() {
  const root = document.getElementById(LEGAL_CONTEXT_REGION_ID);
  const project = root?.querySelector("details.poc-flow-legal-item");
  if (project instanceof HTMLDetailsElement) project.open = true;
}

function LegalContextAccordion() {
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash !== `#${LEGAL_CONTEXT_REGION_ID}`) return;
      openLegalContextProjectPanel();
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div
      className="poc-flow-legal"
      id={LEGAL_CONTEXT_REGION_ID}
      role="region"
      aria-label="Context, bronnen en beperkingen"
    >
      <details className="poc-flow-legal-item" name="legal">
        <summary>Over dit project &amp; beperkingen</summary>
        <div className="poc-flow-legal-body">
          <p>
            <strong>Over de data</strong> — De stellingen en partijtoelichtingen zijn gebaseerd op{" "}
            <strong>openbare StemWijzer-inhoud</strong>. StemWijzer is een merk van ProDemos; deze site is daar
            niet aan gelieerd. Voor de officiële StemWijzer:{" "}
            <ExternalDocLink href="https://stemwijzer.nl/faq">stemwijzer.nl/faq</ExternalDocLink>.
          </p>
          <p>
            <strong>Beperkingen</strong>
          </p>
          <ul className="poc-flow-legal-list">
            <li>
              Dit is <strong>geen stemhulp</strong>: gebruik voor een persoonlijk kiesadvies de officiële
              StemWijzer.
            </li>
            <li>
              De getoonde meerderheid is een momentopname van standpunten en houdt geen rekening met
              coalitieafspraken of uitvoerbaarheid.
            </li>
            <li>Aan deze visualisatie kunnen geen rechten worden ontleend.</li>
          </ul>
        </div>
      </details>

      <details className="poc-flow-legal-item" name="legal">
        <summary>Privacy &amp; techniek</summary>
        <div className="poc-flow-legal-body">
          <ul className="poc-flow-legal-list">
            <li>
              <strong>Geen tracking:</strong> er worden geen analytische cookies of advertentietrackers gebruikt.
            </li>
            <li>
              <strong>Hosting:</strong> deze site draait in een eigen, self-hosted serveromgeving.
            </li>
            <li>
              <strong>AI-verwerking:</strong> de AI-lezing gebruikt Google Gemini om een samenvatting te maken van
              de op deze pagina zichtbare stelling en partijtoelichtingen. Er worden daarbij geen persoonlijke
              kiesprofielen van bezoekers meegestuurd.
            </li>
            <li>
              <strong>Logs:</strong> zoals bij elke server kunnen tijdelijke technische logs worden opgeslagen voor
              beveiliging en foutopsporing.
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}

function ZetelBar({
  result,
  bundle,
  statementKey,
}: {
  result: QuestionZetelResult;
  bundle: StemwijzerCleanBundle;
  statementKey: StatementKey;
}) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [activeDetail, setActiveDetail] = useState<SegmentDetail | null>(null);

  useEffect(() => {
    setTip(null);
    setActiveDetail(null);
  }, [statementKey]);

  useEffect(() => {
    if (!tip) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setTip(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tip]);

  const { totalRaadZetels, somJa, somNee, somNeutraal, somOverigeRaad, ja, nee } = result;
  const mid = somNeutraal + somOverigeRaad;
  const pct = (zetels: number) => (totalRaadZetels > 0 ? (zetels / totalRaadZetels) * 100 : 0);

  const jaValues = ja.map((segment) => segment.zetels);
  const jaMin = jaValues.length ? Math.min(...jaValues) : 0;
  const jaMax = jaValues.length ? Math.max(...jaValues) : 0;

  const neeValues = nee.map((segment) => segment.zetels);
  const neeMin = neeValues.length ? Math.min(...neeValues) : 0;
  const neeMax = neeValues.length ? Math.max(...neeValues) : 0;

  const bindSeg = (segment: ZetelSegment, side: "ja" | "nee") => {
    const explanation = partyExplanationText(bundle, segment.stemwijzerShortName, statementKey);
    const detail: SegmentDetail = {
      stemwijzerShortName: segment.stemwijzerShortName,
      zetels: segment.zetels,
      side,
      explanation,
    };
    const isActive =
      activeDetail?.stemwijzerShortName === segment.stemwijzerShortName && activeDetail.side === side;
    return {
      title: explanation
        ? `${segment.stemwijzerShortName}: ${segment.zetels} zetels (${side})`
        : `${segment.stemwijzerShortName}: ${segment.zetels} zetels (${side}) — geen toelichting`,
      "aria-label": `${segment.stemwijzerShortName}, ${segment.zetels} zetels, ${side === "ja" ? "ja-kant" : "nee-kant"}`,
      "aria-pressed": isActive,
      onClick: () => setActiveDetail(isActive ? null : detail),
      onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setActiveDetail(isActive ? null : detail);
        }
      },
      onMouseEnter: (event: ReactMouseEvent<HTMLButtonElement>) => {
        if (!explanation) {
          setTip(null);
          return;
        }
        setTip({ text: explanation, x: event.clientX, y: event.clientY });
      },
      onMouseMove: (event: ReactMouseEvent<HTMLButtonElement>) => {
        if (explanation) {
          setTip((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : null));
        }
      },
      onMouseLeave: () => setTip(null),
      onFocus: (event: ReactFocusEvent<HTMLButtonElement>) => {
        if (!explanation) {
          setTip(null);
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        setTip({ text: explanation, x: rect.left + rect.width / 2, y: rect.bottom + 6 });
      },
      onBlur: () => setTip(null),
    };
  };

  return (
    <>
      <div className="zetel-bar-shell">
        <div className="zetel-bar-majority-marker" aria-hidden="true">
          <span className="zetel-bar-majority-pct">50%</span>
          <span className="zetel-bar-majority-tick" />
        </div>
        <div className="zetel-bar" role="img" aria-label="Zetelverdeling ja, neutraal en overig, nee">
          <div className="zetel-bar-zone zetel-bar-ja" style={{ width: `${pct(somJa)}%` }}>
            <div className="zetel-bar-inner">
              {ja.map((segment) => (
                <button
                  key={segment.stemwijzerShortName}
                  type="button"
                  className="zetel-seg zetel-seg--ja"
                  style={{
                    flex: segment.zetels,
                    background: zetelShadeJa(segment.zetels, jaMin, jaMax),
                  }}
                  {...bindSeg(segment, "ja")}
                >
                  <span className="zetel-seg-zetels">{segment.zetels}</span>
                  <span className="zetel-seg-name">{segment.stemwijzerShortName}</span>
                </button>
              ))}
            </div>
            <span className="zetel-bar-zone-label">Ja</span>
          </div>

          <div
            className="zetel-bar-zone zetel-bar-mid"
            style={{ width: `${pct(mid)}%` }}
            title={`Neutraal ${somNeutraal} + overige raad ${somOverigeRaad}`}
          >
            <span className="zetel-bar-mid-text">{mid > 0 ? `${mid}` : ""}</span>
          </div>

          <div className="zetel-bar-zone zetel-bar-nee" style={{ width: `${pct(somNee)}%` }}>
            <div className="zetel-bar-inner zetel-bar-inner-nee">
              {nee.map((segment) => (
                <button
                  key={segment.stemwijzerShortName}
                  type="button"
                  className="zetel-seg zetel-seg--nee"
                  style={{
                    flex: segment.zetels,
                    background: zetelShadeNee(segment.zetels, neeMin, neeMax),
                  }}
                  {...bindSeg(segment, "nee")}
                >
                  <span className="zetel-seg-zetels">{segment.zetels}</span>
                  <span className="zetel-seg-name">{segment.stemwijzerShortName}</span>
                </button>
              ))}
            </div>
            <span className="zetel-bar-zone-label">Nee</span>
          </div>
        </div>
      </div>

      {activeDetail && (
        <div className={`poc-flow-segment-card poc-flow-segment-card--${activeDetail.side}`}>
          <div className="poc-flow-segment-card-head">
            <div>
              <p className="poc-flow-segment-side">
                {activeDetail.side === "ja" ? "Ja" : "Nee"} · {activeDetail.zetels} zetels
              </p>
              <h3 className="poc-flow-segment-name">{activeDetail.stemwijzerShortName}</h3>
            </div>
            <button
              type="button"
              className="poc-flow-segment-close"
              onClick={() => setActiveDetail(null)}
            >
              Sluit
            </button>
          </div>
          <p className="poc-flow-segment-copy">
            {activeDetail.explanation ?? "Geen toelichting in deze snapshot."}
          </p>
        </div>
      )}

      {tip && (
        <div className="poc-zetel-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </>
  );
}

function PartyColumn({
  title,
  count,
  segments,
  bundle,
  statementKey,
}: {
  title: string;
  count: number;
  segments: ZetelSegment[];
  bundle: StemwijzerCleanBundle;
  statementKey: StatementKey;
}) {
  return (
    <div className="poc-flow-list-col">
      <h3>
        {title} ({count})
      </h3>
      <ul className="poc-flow-party-list">
        {segments.map((segment) => {
          const explanation = partyExplanationText(bundle, segment.stemwijzerShortName, statementKey);
          return (
            <li key={segment.stemwijzerShortName} className="poc-flow-party-item">
              <details className="poc-flow-party-details">
                <summary className="poc-flow-party-summary">
                  <span className="poc-flow-party-zetels">{segment.zetels}</span>
                  <span className="poc-flow-party-name">{segment.stemwijzerShortName}</span>
                </summary>
                <p className="poc-flow-party-explanation">
                  {explanation ?? "Geen toelichting in deze snapshot."}
                </p>
              </details>
            </li>
          );
        })}
        {segments.length === 0 && <li className="poc-flow-muted">Geen partijen</li>}
      </ul>
    </div>
  );
}

export default function PocFlow() {
  const initialQuery = useMemo(
    () => readPocFlowQuery(typeof window === "undefined" ? "" : window.location.search),
    [],
  );

  const requestedStatementKeyRef = useRef<StatementKey | null>(initialQuery.statementKey);

  const [gmCode, setGmCode] = useState<string | null>(initialQuery.gmCode);
  const [bundle, setBundle] = useState<StemwijzerCleanBundle | null>(null);
  const [nos, setNos] = useState<NosVoteFlowGemeenteJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statementKey, setStatementKey] = useState<StatementKey | null>(initialQuery.statementKey);

  const selected: GemeentePocOption | undefined = useMemo(
    () => GEMEENTEN.find((candidate) => candidate.gmCode === gmCode),
    [gmCode],
  );

  useEffect(() => {
    replacePocFlowQuery({ gmCode, statementKey });
  }, [gmCode, statementKey]);

  useEffect(() => {
    if (!gmCode) {
      setBundle(null);
      setNos(null);
      setErr(null);
      setLoading(false);
      setStatementKey(null);
      return;
    }

    if (!selected) {
      setBundle(null);
      setNos(null);
      setLoading(false);
      setStatementKey(null);
      setErr(`Gemeente ${gmCode} staat niet in deze index.`);
      return;
    }

    let cancelled = false;
    const preferredStatementKey = requestedStatementKeyRef.current;
    requestedStatementKeyRef.current = null;

    setLoading(true);
    setErr(null);

    void Promise.all([loadStemwijzerBundle(gmCode), loadNosGemeente(gmCode)])
      .then(([nextBundle, nextNos]) => {
        if (cancelled) return;
        setBundle(nextBundle);
        setNos(nextNos);
        const keys = statementKeysInOrder(nextBundle);
        const initialStatement =
          preferredStatementKey && keys.includes(preferredStatementKey)
            ? preferredStatementKey
            : keys[0] ?? null;
        setStatementKey(initialStatement);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBundle(null);
        setNos(null);
        setStatementKey(null);
        setErr(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gmCode, selected]);

  const qResult = useMemo(() => {
    if (!bundle || !nos || !statementKey || !selected) return null;
    return computeQuestionZetelDistribution(bundle, nos, selected.edges, statementKey);
  }, [bundle, nos, statementKey, selected]);

  const statementKeyGroups = useMemo(() => {
    const empty = {
      ja: [] as StatementWithMajoritySeatPct[],
      nee: [] as StatementWithMajoritySeatPct[],
      geen: [] as StatementKey[],
    };
    if (!bundle || !nos || !selected) return empty;

    const ja: StatementWithMajoritySeatPct[] = [];
    const nee: StatementWithMajoritySeatPct[] = [];
    const geen: StatementKey[] = [];

    for (const key of statementKeysInOrder(bundle)) {
      const result = computeQuestionZetelDistribution(bundle, nos, selected.edges, key);
      const total = result.totalRaadZetels;
      const category = councilMajorityCategory(total, result.somJa, result.somNee);
      if (category === "ja") {
        ja.push({ key, winZetels: result.somJa, totalRaad: total });
      } else if (category === "nee") {
        nee.push({ key, winZetels: result.somNee, totalRaad: total });
      } else {
        geen.push(key);
      }
    }

    const sortBySeatShare = (left: StatementWithMajoritySeatPct, right: StatementWithMajoritySeatPct) => {
      const leftShare = left.totalRaad > 0 ? left.winZetels / left.totalRaad : 0;
      const rightShare = right.totalRaad > 0 ? right.winZetels / right.totalRaad : 0;
      return rightShare - leftShare;
    };

    ja.sort(sortBySeatShare);
    nee.sort(sortBySeatShare);
    return { ja, nee, geen };
  }, [bundle, nos, selected]);

  const totalRaadDisplay = nos ? totalRaadFromNos(nos) : null;
  const currentStatementTitle = bundle && statementKey ? statementTitle(bundle, statementKey) : null;
  const loadErrorMessage = err ? humanizeGemeenteLoadError(err, selected?.naam ?? gmCode) : null;
  const coverage = qResult ? buildRaadCoverageSummary(qResult) : null;

  return (
    <div className="poc-flow">
      <header className="poc-flow-header">
        <div className="poc-flow-title-row">
          <h1>Raadszetels per stelling</h1>
          <div className="poc-flow-badges" aria-label="Status">
            <span className="poc-flow-badge">PoC</span>
            <span className="poc-flow-badge">niet-officieel</span>
          </div>
        </div>
        <p className="poc-flow-lead">
          Hoe groot is de steun in de gemeenteraad voor de standpunten uit de StemWijzer? Deze site koppelt de
          verkiezingsuitslag aan de{" "}
          <strong>in StemWijzer opgenomen partijstandpunten</strong>. Zo zie je direct of er op papier een
          meerderheid is voor een stelling.
        </p>
        <div className="poc-flow-disclaimer-banner" role="note">
          <p>
            Dit is een onafhankelijke demonstratie en <strong>geen</strong> officieel product van ProDemos of
            StemWijzer.{" "}
            <ExternalDocLink href="https://stemwijzer.nl/faq">StemWijzer FAQ</ExternalDocLink>
            {" · "}
            <a
              className="poc-flow-ext-link"
              href={`#${LEGAL_CONTEXT_REGION_ID}`}
              onClick={() => {
                openLegalContextProjectPanel();
              }}
            >
              Over dit project
            </a>
          </p>
        </div>

        <div className="poc-flow-method-card">
          <div className="poc-flow-method-label">
            <span className="poc-flow-method-icon" aria-hidden>◈</span>
            Hoe wordt dit berekend?
          </div>
          <div className="poc-flow-method-body">
            <p className="poc-flow-method-heading">De berekening</p>
            <p>
              We combineren twee bronnen: de zetelverdeling in de raad en de StemWijzer-posities van partijen
              (<strong>ja / nee / neutraal</strong>). De zetels van partijen met dezelfde positie tellen we bij
              elkaar op.
            </p>

            <div className="info-flow" aria-hidden>
              <div className="info-flow-row">
                <span className="info-flow-box">Zetels</span>
                <div className="info-flow-connector">
                  <span className="info-flow-connector-label">Verkiezingsuitslag</span>
                  <div className="info-flow-track" />
                </div>
                <span className="info-flow-box">Partijen</span>
                <div className="info-flow-connector">
                  <span className="info-flow-connector-label">StemWijzer-standpunten</span>
                  <div className="info-flow-track" />
                </div>
                <span className="info-flow-box info-flow-box--result">
                  Ja / Nee /<br />Geen van beide
                </span>
              </div>
            </div>


            <p className="poc-flow-method-heading">Meerderheid</p>
            <p>
              Er is een meerderheid als één positie <strong>meer dan de helft van de volledige raad</strong>{" "}
              heeft.
            </p>

            <p className="poc-flow-method-heading">Waarom dit geen stemvoorspelling is</p>
            <p>
              Een meerderheid op deze pagina betekent niet dat een voorstel het ook haalt in de raad. In de
              politiek spelen coalitieafspraken, compromissen en nieuwe informatie een rol.
            </p>

            <p className="poc-flow-method-note">
              Peildatum: gebaseerd op de gebruikte zetelverdeling van {POC_SNAPSHOT_META.dateLabel}.
            </p>
          </div>
        </div>
        <div className="poc-flow-source-chips" aria-label="Databronnen en snapshot">
          <span className="poc-flow-chip">StemWijzer-stellingen en standpunten</span>
          <span className="poc-flow-chip">externe zetelbron</span>
          <span className="poc-flow-chip">snapshot {POC_SNAPSHOT_META.dateLabel}</span>
        </div>
      </header>

      <section className="poc-flow-section">
        <div className="poc-flow-gemeente-row">
          <GemeenteAutocomplete
            options={GEMEENTEN}
            value={gmCode}
            onChange={(nextGmCode) => {
              requestedStatementKeyRef.current = null;
              setStatementKey(null);
              setGmCode(nextGmCode);
            }}
            loading={loading}
          />

          {totalRaadDisplay != null && (
            <div className="poc-flow-raad-inline" aria-label="Aantal raadszetels">
              <span className="poc-flow-raad-inline-value">{totalRaadDisplay}</span>
              <span className="poc-flow-raad-inline-rest"> raadszetels</span>
              <div className="poc-flow-muted poc-flow-raad-inline-note">Zetelbron · volledige raad</div>
            </div>
          )}
        </div>

        {gmCode && loading && (
          <StatusCard
            tone="loading"
            title="Gegevens laden"
            body={`De StemWijzer- en zeteldata voor ${selected?.naam ?? gmCode} worden geladen.`}
          />
        )}

        {gmCode && !loading && loadErrorMessage && (
          <StatusCard tone="error" title="Gegevens niet beschikbaar" body={loadErrorMessage} />
        )}
      </section>

      {bundle && nos && selected && (
        <section className="poc-flow-section">
          <label className="poc-flow-label" htmlFor="stmt-select">
            Stelling
          </label>
          <select
            id="stmt-select"
            className="poc-flow-select poc-flow-select--stmt"
            aria-describedby={statementKey ? "statement-heading" : undefined}
            value={statementKey ?? ""}
            onChange={(event) => {
              const nextValue = event.target.value;
              setStatementKey(nextValue ? (nextValue as StatementKey) : null);
            }}
          >
            {statementKeyGroups.ja.length > 0 && (
              <optgroup label="Meerderheid ja">
                {statementKeyGroups.ja.map(({ key, winZetels, totalRaad }) => (
                  <option key={key} value={key}>
                    ({formatSeatShare(winZetels, totalRaad)}✅) {statementTitle(bundle, key)}
                  </option>
                ))}
              </optgroup>
            )}
            {statementKeyGroups.nee.length > 0 && (
              <optgroup label="Meerderheid nee">
                {statementKeyGroups.nee.map(({ key, winZetels, totalRaad }) => (
                  <option key={key} value={key}>
                    ({formatSeatShare(winZetels, totalRaad)}🚫) {statementTitle(bundle, key)}
                  </option>
                ))}
              </optgroup>
            )}
            {statementKeyGroups.geen.length > 0 && (
              <optgroup label="Geen meerderheid">
                {statementKeyGroups.geen.map((key) => (
                  <option key={key} value={key}>
                    {statementTitle(bundle, key)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {statementKey && (
            <h2 id="statement-heading" className="poc-flow-statement">
              {currentStatementTitle}
            </h2>
          )}
        </section>
      )}

      {qResult && bundle && statementKey && coverage && nos && selected && (
        <section className="poc-flow-section poc-flow-result">
          <div className="poc-flow-stats">
            <div className="poc-flow-majority-wrap">
              <p className="poc-flow-majority-hero">
                {majorityLabel(qResult.totalRaadZetels, qResult.somJa, qResult.somNee)}
              </p>
              {coverage.restZetels > 0 && (
                <p className="poc-flow-overige-note">
                  Buiten deze weging: {coverage.restZetels} zetels
                </p>
              )}
            </div>
            <div className="poc-flow-ja-nee-totals" aria-label="Zetels ja en nee t.o.v. volledige raad">
              <div className="poc-flow-total-ja">
                Ja <span className="poc-flow-total-num">{qResult.somJa}</span>
                <span className="poc-flow-total-pct"> ({formatSeatShare(qResult.somJa, qResult.totalRaadZetels)})</span>
              </div>
              <div className="poc-flow-total-nee">
                Nee <span className="poc-flow-total-num">{qResult.somNee}</span>
                <span className="poc-flow-total-pct"> ({formatSeatShare(qResult.somNee, qResult.totalRaadZetels)})</span>
              </div>
            </div>
          </div>

          <ZetelBar result={qResult} bundle={bundle} statementKey={statementKey} />

          <div className="poc-flow-lists">
            <PartyColumn
              title="Ja"
              count={qResult.somJa}
              segments={qResult.ja}
              bundle={bundle}
              statementKey={statementKey}
            />
            <PartyColumn
              title="Neutraal"
              count={qResult.somNeutraal}
              segments={qResult.neutraal}
              bundle={bundle}
              statementKey={statementKey}
            />
            <PartyColumn
              title="Nee"
              count={qResult.somNee}
              segments={[...qResult.nee].sort(
                (left, right) =>
                  right.zetels - left.zetels ||
                  left.stemwijzerShortName.localeCompare(right.stemwijzerShortName, "nl"),
              )}
              bundle={bundle}
              statementKey={statementKey}
            />
          </div>

          {/* {currentStatementTitle && (
            <ExplanationWordPanel
              bundle={bundle}
              nos={nos}
              edges={selected.edges}
              statementKey={statementKey}
              statementTitle={currentStatementTitle}
            />
          )} Dit analysecomponent wordt momenteel niet weergegeven op de website*/}


          {gmCode && (
            <CoalitionAnalysisPanel
              gmCode={gmCode}
              gemeenteLabel={selected.naam}
              statementKey={statementKey}
              statementTitle={currentStatementTitle ?? statementKey}
              majoritySummary={majoritySummaryPlainText(qResult.totalRaadZetels, qResult.somJa, qResult.somNee)}
              bundle={bundle}
              qResult={qResult}
            />
          )}

        <LegalContextAccordion />

        </section>
      )}

      <footer className="poc-flow-footer">
        <p>
          Onafhankelijke proof of concept — niet van, namens of goedgekeurd door ProDemos of StemWijzer. Gebaseerd
          op openbare StemWijzer-inhoud, gecombineerd met een externe zetelbron. Officiële StemWijzer:{" "}
          <ExternalDocLink href="https://stemwijzer.nl">stemwijzer.nl</ExternalDocLink> /{" "}
          <ExternalDocLink href="https://stemwijzer.nl/faq">FAQ</ExternalDocLink>
        </p>
      </footer>
    </div>
  );
}
