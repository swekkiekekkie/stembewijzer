import type { CoalitionRequestBody } from "./coalitionTypes";

/**
 * Prompting-strategie (v2 — politieke analyse):
 *
 * Situatie: gemeenteraadsverkiezingen zijn geweest, zetelaantallen staan vast (NOS).
 * StemWijzer-stellingen + toelichtingen zijn openbare bronteksten van vóór de verkiezingen.
 *
 * Doel: niet alleen een tekstsynthese, maar een politieke inschatting:
 * - Hoeveel zetels zitten achter elk argument?
 * - Welke samenwerkingen zijn denkbaar?
 * - Hoe groot is de kans dat het voorstel (in enige vorm) gerealiseerd wordt?
 *
 * Opbouw:
 * 1. Rol: politiek analist, combineert inhoud met zetelgewicht.
 * 2. Harde cijfers eerst (aggregaten + per partij).
 * 3. Vijf analyse-secties: samenhang, minderheid, scenario's, score, caveat.
 * 4. Output: markdown, max ~600 woorden.
 */
export function buildCoalitionPrompt(body: CoalitionRequestBody): string {
  const z = body.zetelAggregaten;
  const half = z.totalRaadZetels / 2;
  const lines: string[] = [
    "Je bent een politiek analist gespecialiseerd in Nederlandse gemeenteraden. Je combineert openbare StemWijzer-toelichtingen met zetelgewicht om niet alleen inhoudelijke overlap te vinden, maar ook politieke haalbaarheid in te schatten.",
    "",
    "KERNREGELS:",
    "- Noem ALTIJD het zetelantal wanneer je over een partij of groep partijen schrijft (bijv. 'VVD (3) en CDA (2) = 5 zetels').",
    "- Een argument van een grote fractie weegt politiek zwaarder dan dat van een kleine. Besteed proportioneel meer aandacht aan grotere fracties.",
    "- Een minderheid kan de meerderheid niet blokkeren of vetoën — schrijf dat ook niet alsof het kan.",
    "- Twee partijen die hetzelfde stemmen kunnen radicaal andere invullingen bedoelen. Blootleggen.",
    "",
    `Gemeente: ${body.gemeenteLabel} (${body.gmCode}).`,
    `Stelling: "${body.statementTitle}"`,
    "",
    "ZETELVERDELING (NOS — gebruik exact):",
    `  Volledige raad: ${z.totalRaadZetels} zetels (meerderheid = >${Math.floor(half)} zetels)`,
    `  JA-blok (eens):     ${z.somJa} zetels`,
    `  NEE-blok (oneens):  ${z.somNee} zetels`,
    `  NEUTRAAL:           ${z.somNeutraal} zetels`,
    `  Overig (buiten weging): ${z.somOverigeRaad} zetels`,
    "",
    `Conclusie op basis van zetels: ${body.majoritySummary}.`,
    "",

    "OPDRACHT — vijf secties, gebruik ## markdown-kopjes:",
    "",

    "## 1) Meerderheidsblok: samenhang en breuklijnen",
    "Groepeer de partijen uit het meerderheidsblok op gedeelde MOTIVATIE (niet alleen opsommen). Per motivatie-cluster: partijnamen + zetels + wat ze gemeen hebben. Benoem dan de breuklijnen: welke subgroep wijkt af in nuance of voorwaarden, en hoeveel zetels vertegenwoordigt die afwijking? Focus meer op grote fracties.",
    "",

    "## 2) Minderheid: tegenargumenten en raakvlakken",
    "Kort (max ~100 woorden). Wat zijn de kernargumenten van de minderheidspartijen? Waar raakt dat aan zorgen of nuances binnen de meerderheid — niet als machtsmiddel, maar als potentieel amendement of compromisrichting?",
    "",

    "## 3) Politieke scenario's",
    "Schets de scenario's die je politiek het meest aannemelijk vindt. Altijd minstens het 'ongewijzigd'-scenario (de huidige meerderheid). Daarna eventueel varianten: wat als een meerderheidspartij een voorwaarde stelt, of als een minderheidspartij onder bepaalde condities mee zou kunnen stemmen?",
    "Per scenario:",
    "- **Naam/label** (bijv. 'Ongewijzigd voorstel', 'Compromis met X-nuance')",
    "- **Betrokken partijen + zetels** (altijd een totaal noemen)",
    "- **Voorwaarden** op basis van de toelichtingen",
    "- **Haalbaarheid**: kort, 1-2 zinnen",
    "Bepaal zelf hoeveel scenario's zinvol zijn (minimaal 1, geen maximum maar wees bondig).",
    "",

    "## 4) Realisatiescore",
    "Geef een score van 1 tot 5 sterren (★) voor de kans dat dit voorstel in enige vorm gerealiseerd wordt:",
    "- ★☆☆☆☆ = vrijwel uitgesloten",
    "- ★★☆☆☆ = onwaarschijnlijk",
    "- ★★★☆☆ = kans op compromis",
    "- ★★★★☆ = waarschijnlijk",
    "- ★★★★★ = vrijwel zeker",
    "Daaronder:",
    "- Eén zin: meest waarschijnlijke uitwerking.",
    "- Eén zin: grootste onzekerheid.",
    "",

    "## 5) Caveat",
    "Eén tot twee zinnen: dit is een inschatting op basis van openbare StemWijzer-teksten en zetelaantallen, geen bestuurlijke analyse of voorspelling van een collegeakkoord.",
    "",

    "Schrijf helder Nederlands. Gebruik ## markdown-kopjes. Geen JSON. Max ~600 woorden.",
    "",
    "DATA: alle gemapte partijen op deze stelling — JA, NEE én NEUTRAAL — met toelichting en zetels.",
    "",
    "PARTIJEN:",
    "",
  ];

  for (const r of body.rows) {
    const ex = r.explanation.trim() || "(geen toelichting in bron)";
    lines.push(
      `- [${r.side.toUpperCase()} | ${r.positionLabel}] ${r.partyShortName} — ${r.zetels} zetels`,
      `  Toelichting: ${ex}`,
      "",
    );
  }

  return lines.join("\n");
}
