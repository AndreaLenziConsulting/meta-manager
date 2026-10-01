import { describe, expect, it } from "vitest";
import {
  campagneFuoriPeriodoConRisultati,
  haRisultati,
  inserzioniFuoriPeriodoConRisultati,
  residuoNonAttribuito,
  risultatiDaBreakdown,
  risultatiGhlPerTipo,
  sommaRisultati,
  RISULTATI_ZERO,
} from "./dettaglioGhl";
import type { GhlBreakdownCampagna } from "@/types/ghl";

function breakdown(fissati: number, effettuati: number, vendite: number, fatturato: number): GhlBreakdownCampagna {
  return {
    appuntamenti: { totali: fissati, confermati: fissati, annullati: 0, effettuati },
    opportunita: { vendite, fatturato },
  };
}

describe("risultatiDaBreakdown / sommaRisultati / haRisultati", () => {
  it("porta il breakdown GHL alla forma piatta della tabella", () => {
    expect(risultatiDaBreakdown(breakdown(4, 3, 1, 2500))).toEqual({
      appuntamentiFissati: 4,
      appuntamentiEffettuati: 3,
      vendite: 1,
      fatturato: 2500,
    });
  });

  it("somma un elenco vuoto a zero e più righe campo per campo", () => {
    expect(sommaRisultati([])).toEqual(RISULTATI_ZERO);
    expect(sommaRisultati([risultatiDaBreakdown(breakdown(4, 3, 1, 2500)), risultatiDaBreakdown(breakdown(2, 0, 2, 1000))])).toEqual({
      appuntamentiFissati: 6,
      appuntamentiEffettuati: 3,
      vendite: 3,
      fatturato: 3500,
    });
  });

  it("haRisultati è false solo con tutti i valori a zero", () => {
    expect(haRisultati(RISULTATI_ZERO)).toBe(false);
    expect(haRisultati({ ...RISULTATI_ZERO, vendite: 1 })).toBe(true);
    expect(haRisultati({ ...RISULTATI_ZERO, appuntamentiFissati: 1 })).toBe(true);
  });
});

describe("residuoNonAttribuito", () => {
  it("è la differenza fra il totale sede e la somma delle righe", () => {
    const totale = { appuntamentiFissati: 10, appuntamentiEffettuati: 6, vendite: 3, fatturato: 9000 };
    const righe = [risultatiDaBreakdown(breakdown(4, 3, 1, 2500)), risultatiDaBreakdown(breakdown(3, 2, 1, 4000))];
    expect(residuoNonAttribuito(totale, righe)).toEqual({ appuntamentiFissati: 3, appuntamentiEffettuati: 1, vendite: 1, fatturato: 2500 });
  });

  it("non lascia residui fantasma da virgola mobile sul fatturato", () => {
    const totale = { ...RISULTATI_ZERO, fatturato: 0.3 };
    const righe = [
      { ...RISULTATI_ZERO, fatturato: 0.1 },
      { ...RISULTATI_ZERO, fatturato: 0.2 },
    ];
    const residuo = residuoNonAttribuito(totale, righe);
    expect(residuo.fatturato).toBe(0);
    expect(haRisultati(residuo)).toBe(false);
  });

  it("non va mai sotto zero", () => {
    expect(residuoNonAttribuito(RISULTATI_ZERO, [risultatiDaBreakdown(breakdown(1, 1, 1, 100))])).toEqual(RISULTATI_ZERO);
  });
});

describe("campagneFuoriPeriodoConRisultati", () => {
  const anagrafica = new Map([
    ["c-periodo", { nomeCampagna: "Campagna del periodo", tipoCampagna: "Lead Gen" }],
    ["c-vecchia", { nomeCampagna: "Campagna di luglio", tipoCampagna: "Lead Gen" }],
    ["c-vecchia-zero", { nomeCampagna: "Campagna di giugno", tipoCampagna: "Freebie" }],
    ["c-vecchia-2", { nomeCampagna: "Campagna di agosto", tipoCampagna: "Freebie" }],
  ]);
  const perCampagna = {
    "c-periodo": breakdown(5, 4, 1, 3000),
    "c-vecchia": breakdown(0, 0, 1, 5000),
    "c-vecchia-zero": breakdown(0, 0, 0, 0),
    "c-vecchia-2": breakdown(2, 1, 0, 0),
    "c-sconosciuta": breakdown(1, 1, 1, 800),
  };

  it("tiene solo le campagne note, non già mostrate, con almeno un risultato nel periodo", () => {
    const righe = campagneFuoriPeriodoConRisultati({ perCampagna, idMostrati: new Set(["c-periodo"]), anagrafica, filtroCampagne: null });
    // c-periodo già mostrata, c-vecchia-zero senza risultati, c-sconosciuta non in anagrafica.
    expect(righe.map((r) => r.campaignId)).toEqual(["c-vecchia", "c-vecchia-2"]);
    expect(righe[0]).toEqual({
      campaignId: "c-vecchia",
      nomeCampagna: "Campagna di luglio",
      tipoCampagna: "Lead Gen",
      risultati: { appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 1, fatturato: 5000 },
    });
  });

  it("con un filtro campagne attivo tiene solo le campagne selezionate", () => {
    const righe = campagneFuoriPeriodoConRisultati({
      perCampagna,
      idMostrati: new Set(["c-periodo"]),
      anagrafica,
      filtroCampagne: new Set(["c-periodo", "c-vecchia-2"]),
    });
    expect(righe.map((r) => r.campaignId)).toEqual(["c-vecchia-2"]);
  });
});

describe("risultatiGhlPerTipo", () => {
  it("somma per tipo le campagne del periodo con attribuzione e quelle fuori periodo", () => {
    const perCampagna = {
      a: breakdown(5, 4, 1, 3000),
      b: breakdown(1, 0, 0, 0),
      vecchia: breakdown(0, 0, 1, 5000),
    };
    const perTipo = risultatiGhlPerTipo({
      perCampagna,
      campagneDelPeriodo: [
        { campaignId: "a", tipoCampagna: "Lead Gen" },
        { campaignId: "b", tipoCampagna: "Lead Gen" },
        { campaignId: "senza-contatti", tipoCampagna: "Notorietà" },
      ],
      fuoriPeriodo: [
        {
          campaignId: "vecchia",
          nomeCampagna: "Campagna di luglio",
          tipoCampagna: "Freebie",
          risultati: risultatiDaBreakdown(perCampagna.vecchia),
        },
      ],
    });
    expect(perTipo.get("Lead Gen")).toEqual({ appuntamentiFissati: 6, appuntamentiEffettuati: 4, vendite: 1, fatturato: 3000 });
    // Tipo senza spesa nel periodo ma con una vendita del periodo: compare comunque.
    expect(perTipo.get("Freebie")).toEqual({ appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 1, fatturato: 5000 });
    // Nessuna campagna del tipo ha un contatto attribuito: assente (non disponibile), mai zero.
    expect(perTipo.has("Notorietà")).toBe(false);
  });

  it("un tipo con campagne attribuite ma nessun risultato nel periodo vale zero, non assente", () => {
    const perTipo = risultatiGhlPerTipo({
      perCampagna: { a: breakdown(0, 0, 0, 0) },
      campagneDelPeriodo: [{ campaignId: "a", tipoCampagna: "Lead Gen" }],
      fuoriPeriodo: [],
    });
    expect(perTipo.get("Lead Gen")).toEqual(RISULTATI_ZERO);
  });
});

describe("inserzioniFuoriPeriodoConRisultati", () => {
  const anagrafica = {
    "ad-vecchia": { adName: "Video testimonianza", campaignId: "c1", nomeCampagna: "Campagna 1", stato: "PAUSED" },
    "ad-altra-campagna": { adName: "Carosello", campaignId: "c2", nomeCampagna: "Campagna 2", stato: "ACTIVE" },
    "ad-zero": { adName: "Statica", campaignId: "c1", nomeCampagna: "Campagna 1", stato: "PAUSED" },
  };
  const perInserzione = {
    "ad-periodo": breakdown(3, 2, 0, 0),
    "ad-vecchia": breakdown(1, 1, 1, 4000),
    "ad-altra-campagna": breakdown(2, 0, 0, 0),
    "ad-zero": breakdown(0, 0, 0, 0),
    "ad-sparita": breakdown(0, 0, 1, 900),
  };

  it("senza filtro: tutte le inserzioni non mostrate con risultati, anche fuori anagrafica (solo id)", () => {
    const righe = inserzioniFuoriPeriodoConRisultati({ perInserzione, idMostrati: new Set(["ad-periodo"]), anagrafica, filtroCampagne: null });
    expect(righe.map((r) => r.adId)).toEqual(["ad-vecchia", "ad-sparita", "ad-altra-campagna"]);
    expect(righe[0]).toMatchObject({ adName: "Video testimonianza", campaignId: "c1", nomeCampagna: "Campagna 1", stato: "PAUSED" });
    expect(righe[1]).toMatchObject({ adName: "", campaignId: "", nomeCampagna: "", stato: "" });
  });

  it("con filtro campagne: solo le inserzioni la cui campagna è selezionata, mai quelle fuori anagrafica", () => {
    const righe = inserzioniFuoriPeriodoConRisultati({
      perInserzione,
      idMostrati: new Set(["ad-periodo"]),
      anagrafica,
      filtroCampagne: new Set(["c1"]),
    });
    expect(righe.map((r) => r.adId)).toEqual(["ad-vecchia"]);
  });
});
