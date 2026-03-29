/**
 * Genormaliseerde (“clean”) uitslagen: camelCase, afgeleide sleutels, geen snake_case.
 */

export interface CleanPartyRef {
  name: string;
  shortName: string;
}

export interface CleanGemeenteUitslag {
  status: string;
  publicatieDatumTijd: string;
  gemeenteNaam: string;
  /** Bijv. `G0014` */
  cbsCode: string;
  /** Vier cijfers, join-key met StemWijzer `GMxxxx`. */
  gemeenteDigits: string;
  provincieCode: string | null;
  provincieNaam: string | null;
  provincieInwoners: number | null;
  gemeenteInwoners: number;
  opkomstPromillage: number;
  opkomstVorigePromillage: number;
  eerstePartij: CleanPartyRef;
  tweedePartij: CleanPartyRef;
}

export interface CleanLandelijkVerkiezingTotaal {
  verkiezingCode: string;
  kiesgerechtigden: number;
  zetels: number;
  opkomst: number;
  opkomstPromillage: number;
  ongeldig: number;
  ongeldigPromillage: number;
  blanco: number;
  blancoPromillage: number;
}

export interface CleanLandelijkPartijUitslag {
  party: CleanPartyRef;
  current: {
    verkiezingCode: string;
    stemmen: number;
    stemmenPromillage: number;
    zetels: number;
  };
  previous: {
    verkiezingCode: string;
    stemmen: number;
    stemmenPromillage: number;
    zetels: number;
  };
}

export interface CleanLandelijkeUitslag {
  publicatieDatumTijd: string;
  aantalUitslagen: number;
  huidigeVerkiezing: CleanLandelijkVerkiezingTotaal;
  vorigeVerkiezing: CleanLandelijkVerkiezingTotaal;
  partijen: CleanLandelijkPartijUitslag[];
}

/**
 * Volledige gedemanglede uitslagen + indexes voor joins.
 * `byGemeenteDigits` gebruikt hetzelfde format als `extractGemeenteDigits` (4 cijfers).
 */
export interface UitslagenCleanBundle {
  gemeentes: CleanGemeenteUitslag[];
  landelijk: CleanLandelijkeUitslag;
  byGemeenteDigits: Record<string, CleanGemeenteUitslag>;
  /** `shortName` → zetels huidige GR (landelijk). */
  nationalZetelsByShortName: Record<string, number>;
  /** `shortName` → stemmen huidige GR (landelijk). */
  nationalStemmenByShortName: Record<string, number>;
}
