import { extractGemeenteDigits } from "../stembewijzer/cbs";
import type {
  CleanGemeenteUitslag,
  CleanLandelijkeUitslag,
  CleanLandelijkPartijUitslag,
  CleanLandelijkVerkiezingTotaal,
  CleanPartyRef,
  UitslagenCleanBundle,
} from "./domain";
import type {
  UitslagenWireGemeenteRow,
  UitslagenWireLandelijkTotaal,
  UitslagenWireLandelijkePartijRow,
  UitslagenWireLandelijkeUitslag,
  UitslagenWirePartijRef,
  UitslagenWireRoot,
} from "./raw";

function partyRef(w: UitslagenWirePartijRef): CleanPartyRef {
  return { name: w.name, shortName: w.short_name };
}

function landelijkTotaal(w: UitslagenWireLandelijkTotaal): CleanLandelijkVerkiezingTotaal {
  return {
    verkiezingCode: w.verkiezing_code,
    kiesgerechtigden: w.kiesgerechtigden,
    zetels: w.zetels,
    opkomst: w.opkomst,
    opkomstPromillage: w.opkomst_promillage,
    ongeldig: w.ongeldig,
    ongeldigPromillage: w.ongeldig_promillage,
    blanco: w.blanco,
    blancoPromillage: w.blanco_promillage,
  };
}

function landelijkePartijRow(w: UitslagenWireLandelijkePartijRow): CleanLandelijkPartijUitslag {
  return {
    party: partyRef(w.partij),
    current: {
      verkiezingCode: w.huidig.verkiezing_code,
      stemmen: w.huidig.stemmen,
      stemmenPromillage: w.huidig.stemmen_promillage,
      zetels: w.huidig.zetels,
    },
    previous: {
      verkiezingCode: w.vorig.verkiezing_code,
      stemmen: w.vorig.stemmen,
      stemmenPromillage: w.vorig.stemmen_promillage,
      zetels: w.vorig.zetels,
    },
  };
}

function mapLandelijkeUitslag(w: UitslagenWireLandelijkeUitslag): CleanLandelijkeUitslag {
  return {
    publicatieDatumTijd: w.publicatie_datum_tijd,
    aantalUitslagen: w.aantal_uitslagen,
    huidigeVerkiezing: landelijkTotaal(w.huidige_verkiezing),
    vorigeVerkiezing: landelijkTotaal(w.vorige_verkiezing),
    partijen: w.partijen.map(landelijkePartijRow),
  };
}

function gemeenteRow(w: UitslagenWireGemeenteRow): CleanGemeenteUitslag {
  const digits = extractGemeenteDigits(w.gemeente.cbs_code);
  if (!digits) {
    throw new Error(`Ongeldige cbs_code in uitslagen: ${w.gemeente.cbs_code}`);
  }
  const p = w.gemeente.provincie;
  return {
    status: w.status,
    publicatieDatumTijd: w.publicatie_datum_tijd,
    gemeenteNaam: w.gemeente.naam,
    cbsCode: w.gemeente.cbs_code,
    gemeenteDigits: digits,
    provincieCode: p?.code ?? null,
    provincieNaam: p?.naam ?? null,
    provincieInwoners: p?.aantal_inwoners ?? null,
    gemeenteInwoners: w.gemeente.aantal_inwoners,
    opkomstPromillage: w.huidige_verkiezing.opkomst_promillage,
    opkomstVorigePromillage: w.vorige_verkiezing.opkomst_promillage,
    eerstePartij: partyRef(w.eerste_partij),
    tweedePartij: partyRef(w.tweede_partij),
  };
}

/**
 * Wire → clean bundle + indexes (`byGemeenteDigits`, landelijke zetels/stemmen per lijstnaam).
 */
export function normalizeUitslagenWire(wire: UitslagenWireRoot): UitslagenCleanBundle {
  const gemeentes = wire.gemeentes.map(gemeenteRow);
  const byGemeenteDigits: Record<string, CleanGemeenteUitslag> = {};
  for (const g of gemeentes) {
    byGemeenteDigits[g.gemeenteDigits] = g;
  }

  const landelijk = mapLandelijkeUitslag(wire.landelijke_uitslag);
  const nationalZetelsByShortName: Record<string, number> = {};
  const nationalStemmenByShortName: Record<string, number> = {};
  for (const r of landelijk.partijen) {
    const sn = r.party.shortName;
    nationalZetelsByShortName[sn] = r.current.zetels;
    nationalStemmenByShortName[sn] = r.current.stemmen;
  }

  return {
    gemeentes,
    landelijk,
    byGemeenteDigits,
    nationalZetelsByShortName,
    nationalStemmenByShortName,
  };
}
