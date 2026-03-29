import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import type { StatementKey } from "@/lib/stembewijzer/domain";
import type { StemwijzerCleanBundle } from "@/lib/stembewijzer/domain";
import type { QuestionZetelResult } from "@/lib/poc/pocQuestionZetels";
import type { CoalitionGetResponseBody, CoalitionResponseBody } from "@/lib/gemini/coalitionTypes";
import { coalitionPayloadFingerprint } from "@/lib/gemini/coalitionCacheKeys";

import { buildCoalitionRequestBody, buildCoalitionRows, buildZetelAggregaten } from "./coalitionPayload";

import "./CoalitionAnalysisPanel.css";

type ServerEntry = { text: string; savedAt: string; source: "disk" | "gemini" };

type Props = {
  gmCode: string;
  gemeenteLabel: string;
  statementKey: StatementKey;
  statementTitle: string;
  majoritySummary: string;
  bundle: StemwijzerCleanBundle;
  qResult: QuestionZetelResult;
};

function analysisSourceLabel(source: "disk" | "gemini"): string {
  return source === "gemini"
    ? "Nieuw gegenereerde, niet-officiële interpretatie"
    : "Opgeslagen lezing uit servercache";
}

function humanizeProbeError(error: string): string {
  return `De opgeslagen lezing kon nu niet worden opgehaald. ${error}`;
}

function humanizePostError(error: string): string {
  return `Het opbouwen van een nieuwe lezing lukte nu niet. ${error}`;
}

export default function CoalitionAnalysisPanel({
  gmCode,
  gemeenteLabel,
  statementKey,
  statementTitle,
  majoritySummary,
  bundle,
  qResult,
}: Props) {
  const rows = useMemo(
    () => buildCoalitionRows(bundle, statementKey, qResult),
    [bundle, statementKey, qResult],
  );
  const agg = useMemo(() => buildZetelAggregaten(qResult), [qResult]);
  const fp = useMemo(() => coalitionPayloadFingerprint(rows, agg), [rows, agg]);

  const [serverEntry, setServerEntry] = useState<ServerEntry | null>(null);
  const [probeDone, setProbeDone] = useState(false);
  const [loadingProbe, setLoadingProbe] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);
  const [getErr, setGetErr] = useState<string | null>(null);
  const [postErr, setPostErr] = useState<string | null>(null);

  useEffect(() => {
    setServerEntry(null);
    setGetErr(null);
    setPostErr(null);
    setProbeDone(false);
    setLoadingProbe(true);
    const q = new URLSearchParams({ gmCode, statementKey, fp });
    void fetch(`/api/gemini/coalition?${q.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as CoalitionGetResponseBody;
        if (!data.ok) {
          setGetErr(data.error ?? "Onbekende fout");
          return;
        }
        if (data.hit) {
          setServerEntry({ text: data.text, savedAt: data.savedAt, source: "disk" });
        }
      })
      .catch((e: unknown) => {
        setGetErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setProbeDone(true);
        setLoadingProbe(false);
      });
  }, [gmCode, statementKey, fp]);

  const runAnalysis = useCallback(async () => {
    setLoadingPost(true);
    setPostErr(null);
    try {
      const body = buildCoalitionRequestBody(
        gmCode,
        gemeenteLabel,
        statementKey,
        statementTitle,
        qResult,
        majoritySummary,
        rows,
      );
      const res = await fetch("/api/gemini/coalition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as CoalitionResponseBody;
      if (!data.ok) {
        setPostErr(data.error ?? "Onbekende fout");
        return;
      }
      setServerEntry({
        text: data.text,
        savedAt: data.savedAt,
        source: data.source,
      });
    } catch (e: unknown) {
      setPostErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingPost(false);
    }
  }, [
    gmCode,
    gemeenteLabel,
    statementKey,
    statementTitle,
    qResult,
    majoritySummary,
    rows,
  ]);

  const hasText = Boolean(serverEntry?.text);
  const canRequestAnalysis = probeDone && !loadingProbe && !loadingPost && !hasText;

  return (
    <details className="poc-coalition-wrap">
      <summary className="poc-coalition-wrap-summary">
        <span className="poc-coalition-wrap-title">Experimentele AI-analyse</span>
        <span className="poc-coalition-wrap-badge" aria-hidden>
          experimenteel
        </span>
      </summary>
      <div className="poc-coalition">
        <div className="poc-coalition-head">
          <p className="poc-coalition-intro">
            De zetelbalk hierboven laat zien <em>hoeveel</em> zetels achter ja of nee zitten, maar niet{" "}
            <em>waarom</em>. De AI-analyse leest de openbare StemWijzer-toelichtingen van alle partijen en
            combineert die met het zetelgewicht. Zo ontstaat een beeld van:
          </p>
          <ul className="poc-coalition-intro-list">
            <li>
              <strong>Samenhang en breuklijnen</strong> — delen de partijen in het meerderheidsblok dezelfde
              motivatie, of willen ze hetzelfde om verschillende redenen?
            </li>
            <li>
              <strong>Tegenargumenten</strong> — wat brengt de minderheid in, en waar raakt dat aan twijfels
              binnen de meerderheid?
            </li>
            <li>
              <strong>Politieke scenario's</strong> — welke compromissen of verschuivingen zijn denkbaar als
              je de toelichtingen naast elkaar legt?
            </li>
            <li>
              <strong>Realisatiescore</strong> — een ruwe inschatting (★ tot ★★★★★) van de kans dat het
              voorstel in enige vorm doorgaat.
            </li>
          </ul>
          <p className="poc-coalition-disclaimer">
            Let op: dit is een automatisch gegenereerde interpretatie, niet redactioneel gecontroleerd. Gebruik
            haar als verkennende samenvatting, niet als feitelijke voorspelling. Deze analyse wordt hooguit eenmaal
            gegenereerd, en daarna aan elke gebruiker weergegeven. Voor verzoeken om een bestaande AI-analyse te verwijderen of van extra commentaar te voorzien, contacteer de sitebeheerder.
          </p>
        </div>

      {!hasText && (
        <div className="poc-coalition-state" aria-live="polite">
          {loadingProbe && (
            <>
              <p className="poc-coalition-state-title">Cache controleren</p>
              <p className="poc-coalition-state-copy">
                We kijken of er al een opgeslagen AI-analyse voor deze stelling klaarstaat.
              </p>
            </>
          )}

          {!loadingProbe && !loadingPost && !getErr && !postErr && probeDone && (
            <>
              <p className="poc-coalition-state-title">Nog geen opgeslagen analyse</p>
              <p className="poc-coalition-state-copy">
                Er is voor deze stelling nog geen AI-analyse gegenereerd.
              </p>
            </>
          )}

          {!loadingProbe && getErr && (
            <>
              <p className="poc-coalition-state-title">Opgeslagen AI-analyse nu niet bereikbaar</p>
              <p className="poc-coalition-state-copy">{humanizeProbeError(getErr)}</p>
            </>
          )}

          {!loadingProbe && postErr && (
            <>
              <p className="poc-coalition-state-title">AI-analyse genereren mislukt</p>
              <p className="poc-coalition-state-copy">{humanizePostError(postErr)}</p>
            </>
          )}

          {loadingPost && (
            <>
              <p className="poc-coalition-state-title">AI-analyse genereren</p>
              <p className="poc-coalition-state-copy">
                De AI-analyse wordt gegenereerd. Dit kan enkele momenten duren.
              </p>
            </>
          )}

          {canRequestAnalysis && (
            <button
              type="button"
              className="poc-coalition-btn"
              disabled={loadingPost}
              onClick={() => void runAnalysis()}
            >
              {postErr ? "Probeer opnieuw" : "Genereer AI-analyse"}
            </button>
          )}
        </div>
      )}

      {hasText && serverEntry && (
        <div className="poc-coalition-ai-output" aria-live="polite">
          <div className="poc-coalition-ai-label">
            <span className="poc-coalition-ai-icon" aria-hidden>✦</span>
            AI-gegenereerd
          </div>
          <p className="poc-coalition-meta">
            {analysisSourceLabel(serverEntry.source)}
            {serverEntry.savedAt
              ? ` · ${new Date(serverEntry.savedAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}`
              : ""}
          </p>
          <article className="poc-coalition-body poc-coalition-md">
            <ReactMarkdown>{serverEntry.text}</ReactMarkdown>
          </article>
        </div>
      )}
      </div>
    </details>
  );
}
