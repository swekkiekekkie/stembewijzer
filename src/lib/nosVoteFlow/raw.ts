/**
 * Wire-formaat `voteflow.api.nos.nl/{GRxx}/gemeente/Gxxxx.json` (per gemeente).
 */

export interface NosVoteFlowPartijRef {
  name: string;
  short_name: string;
}

export interface NosVoteFlowPartijRij {
  partij: NosVoteFlowPartijRef;
  huidig: {
    verkiezing_code: string;
    stemmen: number;
    stemmen_promillage: number;
    zetels: number;
  };
  vorig: {
    verkiezing_code: string;
    stemmen: number;
    stemmen_promillage: number;
    zetels: number;
  };
}

export interface NosVoteFlowGemeenteJson {
  status: string;
  publicatie_datum_tijd: string;
  gemeente: {
    naam: string;
    cbs_code: string;
    provincie?: { code: string; naam: string; aantal_inwoners?: number };
    kieskring: unknown | null;
    aantal_inwoners: number;
  };
  huidige_verkiezing: Record<string, unknown>;
  vorige_verkiezing: Record<string, unknown>;
  partijen: NosVoteFlowPartijRij[];
}
