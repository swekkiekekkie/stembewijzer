import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testBundle, testGemeenten, testNos, testStatementA, testStatementB } from "@/test/pocFixtures";

const loadStemwijzerBundleMock = vi.fn();
const loadNosGemeenteMock = vi.fn();

vi.mock("@/lib/poc/gemeentePocIndex", () => ({
  buildGemeentePocIndex: () => testGemeenten,
}));

vi.mock("@/lib/poc/loadGemeenteSnapshots", () => ({
  loadStemwijzerBundle: (gmCode: string) => loadStemwijzerBundleMock(gmCode),
  loadNosGemeente: (gmCode: string) => loadNosGemeenteMock(gmCode),
}));

vi.mock("./CoalitionAnalysisPanel", () => ({
  default: () => <div data-testid="coalition-panel">Gemini panel</div>,
}));

import PocFlow from "./PocFlow";

describe("PocFlow", () => {
  beforeEach(() => {
    loadStemwijzerBundleMock.mockResolvedValue(testBundle);
    loadNosGemeenteMock.mockResolvedValue(testNos);
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows onboarding copy when no municipality is selected", () => {
    render(<PocFlow />);

    expect(screen.getByRole("heading", { name: "Raadszetels per stelling" })).toBeInTheDocument();
    expect(screen.getByText(/Kies een gemeente, bekijk een stelling/i)).toBeInTheDocument();
    expect(loadStemwijzerBundleMock).not.toHaveBeenCalled();
  });

  it("uses the first valid statement for a gmCode-only deeplink and syncs the URL", async () => {
    window.history.replaceState({}, "", "/?gmCode=GM0001");

    render(<PocFlow />);

    expect(
      await screen.findByRole("heading", {
        name: "Woningbouw moet voorrang krijgen boven extra parkeerplaatsen.",
      }),
    ).toBeInTheDocument();

    expect(window.location.search).toContain("gmCode=GM0001");
    expect(window.location.search).toContain(`statementKey=${encodeURIComponent(testStatementA)}`);
  });

  it("honors a deeplinked statementKey and shows uncovered-seat guidance", async () => {
    window.history.replaceState(
      {},
      "",
      `/?gmCode=GM0001&statementKey=${encodeURIComponent(testStatementB)}`,
    );

    render(<PocFlow />);

    expect(
      await screen.findByRole("heading", {
        name: "De gemeente moet betaald parkeren uitbreiden in het centrum.",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Buiten deze weging:\s*6 zetels/i)).toBeInTheDocument();
  });

  it("opens fixed segment details when a party segment is clicked", async () => {
    window.history.replaceState({}, "", `/?gmCode=GM0001&statementKey=${encodeURIComponent(testStatementA)}`);

    render(<PocFlow />);

    await screen.findByRole("heading", {
      name: "Woningbouw moet voorrang krijgen boven extra parkeerplaatsen.",
    });

    fireEvent.click(screen.getByRole("button", { name: /Samen, 12 zetels, ja-kant/i }));

    expect(
      await screen.findByText(
        "Samen wil sneller bouwen om starters en gezinnen meer ruimte te geven.",
      ),
    ).toBeInTheDocument();
  });
});
