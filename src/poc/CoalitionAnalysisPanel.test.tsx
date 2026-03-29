import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testBundle, testQResult, testStatementA } from "@/test/pocFixtures";

import CoalitionAnalysisPanel from "./CoalitionAnalysisPanel";

function renderPanel() {
  return render(
    <CoalitionAnalysisPanel
      gmCode="GM0001"
      gemeenteLabel="Voorbeelddam"
      statementKey={testStatementA}
      statementTitle="Woningbouw moet voorrang krijgen boven extra parkeerplaatsen."
      majoritySummary="Zetelmeerderheid voor de stelling"
      bundle={testBundle}
      qResult={testQResult}
    />,
  );
}

describe("CoalitionAnalysisPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a loading state while checking the cache", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)) as typeof fetch);

    renderPanel();

    expect(screen.getByText("Cache controleren")).toBeInTheDocument();
    expect(
      screen.getByText("We kijken of er al een opgeslagen lezing voor deze stelling klaarstaat."),
    ).toBeInTheDocument();
  });

  it("shows a cache-miss CTA and can generate a new analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ ok: true, hit: false }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            text: "## Nieuwe analyse\n\nMeerderheidspartijen liggen dicht bij elkaar.",
            savedAt: "2026-03-25T10:15:00Z",
            source: "gemini",
          }),
        }) as typeof fetch,
    );

    renderPanel();

    expect(await screen.findByText("Nog geen opgeslagen lezing")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Genereer lezing" }));

    expect(
      await screen.findByText(/Nieuw gegenereerde, niet-officiële interpretatie/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Nieuwe analyse")).toBeInTheDocument();
  });

  it("renders cached content when the probe returns a hit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          hit: true,
          text: "## Cache-hit\n\nDeze analyse kwam al uit de servercache.",
          savedAt: "2026-03-25T09:30:00Z",
        }),
      }) as typeof fetch,
    );

    renderPanel();

    expect(await screen.findByText(/Opgeslagen lezing uit servercache/i)).toBeInTheDocument();
    expect(screen.getByText("Cache-hit")).toBeInTheDocument();
  });

  it("shows an error state when the cache probe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("verbinding verbroken")) as typeof fetch,
    );

    renderPanel();

    expect(await screen.findByText("Opgeslagen AI-lezing nu niet bereikbaar")).toBeInTheDocument();
    expect(
      screen.getByText("De opgeslagen lezing kon nu niet worden opgehaald. verbinding verbroken"),
    ).toBeInTheDocument();
  });
});
