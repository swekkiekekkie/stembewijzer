import { computeQuestionZetelDistribution } from "@/lib/poc/pocQuestionZetels";
import type { MappingEdgeLike } from "@/lib/poc/pocQuestionZetels";
import type { NosVoteFlowGemeenteJson } from "@/lib/nosVoteFlow/raw";
import type { StatementKey, StemwijzerCleanBundle } from "@/lib/stembewijzer/domain";

export const testStatementA = "wonen:0" as StatementKey;
export const testStatementB = "parkeren:1" as StatementKey;

export const testEdges: MappingEdgeLike[] = [
  { stemwijzerShortName: "Samen", nosShortName: "Samen" },
  { stemwijzerShortName: "Open", nosShortName: "Open" },
  { stemwijzerShortName: "Lokaal", nosShortName: "Lokaal" },
];

export const testGemeenten = [
  { gmCode: "GM0001", naam: "Voorbeelddam", edges: testEdges },
  { gmCode: "GM0002", naam: "Tweedorp", edges: testEdges },
];

export const testBundle: StemwijzerCleanBundle = {
  meta: {
    votematchNumericId: 1,
    label: "Voorbeelddam",
    context: "2026GR",
    date: "2026-03-25",
    remoteId: "GM0001",
    langcode: "nl",
  },
  statements: [
    {
      key: testStatementA,
      theme: "Wonen",
      themeId: "wonen",
      title: "Woningbouw moet voorrang krijgen boven extra parkeerplaatsen.",
      orderIndex: 0,
      isShootout: false,
    },
    {
      key: testStatementB,
      theme: "Mobiliteit",
      themeId: "parkeren",
      title: "De gemeente moet betaald parkeren uitbreiden in het centrum.",
      orderIndex: 1,
      isShootout: false,
    },
  ],
  shootoutStatements: [],
  parties: [
    {
      key: "samen",
      shortName: "Samen",
      fullName: "Samen Vooruit",
      logoAsset: "samen.svg",
      website: null,
      participates: true,
      hasSeats: true,
      positions: {
        [testStatementA]: "agree",
        [testStatementB]: "disagree",
      },
      explanations: {
        [testStatementA]: "Samen wil sneller bouwen om starters en gezinnen meer ruimte te geven.",
        [testStatementB]: "Samen wil het centrum bereikbaar houden zonder extra parkeerdruk.",
      },
    },
    {
      key: "open",
      shortName: "Open",
      fullName: "Open Stad",
      logoAsset: "open.svg",
      website: null,
      participates: true,
      hasSeats: true,
      positions: {
        [testStatementA]: "disagree",
        [testStatementB]: "agree",
      },
      explanations: {
        [testStatementA]: "Open wil eerst bestaande buurten ontzien en kiest voor behoud van parkeerplaatsen.",
        [testStatementB]: "Open ziet betaald parkeren als manier om de binnenstad leefbaar te houden.",
      },
    },
    {
      key: "lokaal",
      shortName: "Lokaal",
      fullName: "Lokaal Belang",
      logoAsset: "lokaal.svg",
      website: null,
      participates: true,
      hasSeats: true,
      positions: {
        [testStatementA]: "agree",
        [testStatementB]: "neither",
      },
      explanations: {
        [testStatementA]: "Lokaal ziet woningbouw als noodzakelijk zolang voorzieningen meegroeien.",
        [testStatementB]: "Lokaal wil eerst een proefperiode voordat het beleid wordt uitgebreid.",
      },
    },
  ],
};

export const testNos: NosVoteFlowGemeenteJson = {
  status: "ok",
  publicatie_datum_tijd: "2026-03-25T09:00:00Z",
  gemeente: {
    naam: "Voorbeelddam",
    cbs_code: "GM0001",
    kieskring: null,
    aantal_inwoners: 12345,
  },
  huidige_verkiezing: {
    zetels: 31,
  },
  vorige_verkiezing: {},
  partijen: [
    {
      partij: { name: "Samen Vooruit", short_name: "Samen" },
      huidig: { verkiezing_code: "GR2026", stemmen: 1200, stemmen_promillage: 380, zetels: 12 },
      vorig: { verkiezing_code: "GR2022", stemmen: 1100, stemmen_promillage: 340, zetels: 11 },
    },
    {
      partij: { name: "Open Stad", short_name: "Open" },
      huidig: { verkiezing_code: "GR2026", stemmen: 900, stemmen_promillage: 290, zetels: 9 },
      vorig: { verkiezing_code: "GR2022", stemmen: 850, stemmen_promillage: 270, zetels: 8 },
    },
    {
      partij: { name: "Lokaal Belang", short_name: "Lokaal" },
      huidig: { verkiezing_code: "GR2026", stemmen: 400, stemmen_promillage: 120, zetels: 4 },
      vorig: { verkiezing_code: "GR2022", stemmen: 450, stemmen_promillage: 140, zetels: 5 },
    },
    {
      partij: { name: "Restlijst", short_name: "Rest" },
      huidig: { verkiezing_code: "GR2026", stemmen: 500, stemmen_promillage: 160, zetels: 6 },
      vorig: { verkiezing_code: "GR2022", stemmen: 600, stemmen_promillage: 180, zetels: 7 },
    },
  ],
};

export const testQResult = computeQuestionZetelDistribution(
  testBundle,
  testNos,
  testEdges,
  testStatementA,
);
