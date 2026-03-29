import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { testBundle, testEdges, testNos, testStatementA } from "@/test/pocFixtures";

import ExplanationWordPanel from "./ExplanationWordPanel";

describe("ExplanationWordPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("shows local party word stats and can hide a word client-side", async () => {
    render(
      <ExplanationWordPanel
        bundle={testBundle}
        nos={testNos}
        edges={testEdges}
        statementKey={testStatementA}
        statementTitle="Woningbouw moet voorrang krijgen boven extra parkeerplaatsen."
      />,
    );

    expect(screen.getByText("Woordbeeld in toelichtingen")).toBeInTheDocument();
    expect(await screen.findByText("bouwen")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Oninteressant" })[0]!);

    expect(screen.getByText("Verborgen woorden")).toBeInTheDocument();
  });
});
