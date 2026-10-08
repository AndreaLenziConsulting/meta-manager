import { describe, expect, it } from "vitest";
import { costruisciAndamentoVenditori, mesiInteriNelPeriodo, risultatiVenditoriInteriNelPeriodo, type GhlPerVenditori } from "./andamentoVenditori";
import type { Venditore } from "@/types/kpi";

const venditore = (id: string, ghlUserId = ""): Venditore => ({ venditoreId: id, sedeId: "s1", nome: id.toUpperCase(), capienzaAppuntamentiMensile: 0, attivo: true, ghlUserId });
const SETTIMANE = ["2026-09-07", "2026-09-14", "2026-09-21"];
const PERIODO = { da: "2026-09-09", a: "2026-09-27", settimane: SETTIMANE };

const ghlOk = (over: Partial<Extract<GhlPerVenditori, { stato: "ok" }>> = {}): GhlPerVenditori => ({
  stato: "ok",
  calendariCollegati: true,
  perVenditore: {
    anna: { appuntamenti: { totali: 10, confermati: 8, annullati: 2, effettuati: 6 }, opportunita: { vendite: 2, fatturato: 9000 } },
    luca: { appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 }, opportunita: { vendite: 0, fatturato: 0 } },
  },
  perSettimana: {
    anna: [
      { settimana: "2026-09-07", fissati: 4, effettuati: 3, vendite: 0, fatturato: 0 },
      { settimana: "2026-09-21", fissati: 6, effettuati: 3, vendite: 2, fatturato: 9000 },
    ],
    luca: [],
  },
  ...over,
});

describe("mesi interi nel periodo", () => {
  it("solo i mesi coperti dal primo all'ultimo giorno", () => {
    expect(mesiInteriNelPeriodo("2026-08-01", "2026-09-30")).toEqual(["2026-08", "2026-09"]);
    expect(mesiInteriNelPeriodo("2026-08-02", "2026-10-15")).toEqual(["2026-09"]);
    expect(mesiInteriNelPeriodo("2026-09-09", "2026-10-08")).toEqual([]);
    expect(mesiInteriNelPeriodo("2026-12-01", "2027-01-31")).toEqual(["2026-12", "2027-01"]);
  });

  it("i risultati inseriti a mano contano solo per quei mesi, e solo per la sede chiesta", () => {
    const righe = [
      { mese: "2026-08", sedeId: "s1", venditoreId: "anna", appuntamentiFissati: 5, vendite: 1, fatturato: 4000 },
      { mese: "2026-09", sedeId: "s1", venditoreId: "anna", appuntamentiFissati: 7, vendite: 2, fatturato: 8000 },
      { mese: "2026-09", sedeId: "s2", venditoreId: "altro", appuntamentiFissati: 9, vendite: 9, fatturato: 9 },
    ];
    expect(risultatiVenditoriInteriNelPeriodo(righe, "s1", "2026-08-15", "2026-09-30")).toEqual([{ mese: "2026-09", venditoreId: "anna", appuntamentiFissati: 7, vendite: 2, fatturato: 8000 }]);
    expect(risultatiVenditoriInteriNelPeriodo(righe, "s1", "2026-09-09", "2026-10-08")).toEqual([]);
  });
});

describe("venditori da GHL", () => {
  const venditori = [venditore("anna", "u-anna"), venditore("luca", "u-luca")];

  it("totali del periodo da GHL, con la chiusura sugli appuntamenti presi", () => {
    const { righe } = costruisciAndamentoVenditori({ venditori, ...PERIODO, ghl: ghlOk(), mensili: [] });
    expect(righe[0]).toEqual({ venditoreId: "anna", nome: "ANNA", fonte: "ghl", disponibilita: "ok", appuntamentiFissati: 10, appuntamentiEffettuati: 6, vendite: 2, fatturato: 9000, chiusura: 0.2 });
  });

  it("zero appuntamenti letti da GHL è uno zero vero; la chiusura senza appuntamenti non si calcola", () => {
    const { righe } = costruisciAndamentoVenditori({ venditori, ...PERIODO, ghl: ghlOk(), mensili: [] });
    expect(righe[1]).toMatchObject({ disponibilita: "ok", appuntamentiFissati: 0, vendite: 0, fatturato: 0, chiusura: null });
  });

  it("il grafico è a settimane, sulla griglia del periodo: una settimana senza nulla vale zero", () => {
    const esito = costruisciAndamentoVenditori({ venditori, ...PERIODO, ghl: ghlOk(), mensili: [] });
    expect(esito.grana).toBe("settimana");
    expect(esito.statoGrafico).toBe("ok");
    expect(esito.nelGrafico).toEqual(["anna", "luca"]);
    expect(esito.punti.map((p) => p.chiave)).toEqual(SETTIMANE);
    expect(esito.punti.map((p) => p.valori.anna?.appuntamenti)).toEqual([4, 0, 6]);
    expect(esito.punti.map((p) => p.valori.anna?.fatturato)).toEqual([0, 0, 9000]);
    expect(esito.punti.map((p) => p.valori.luca?.vendite)).toEqual([0, 0, 0]);
  });

  it("senza calendari collegati gli appuntamenti sono ignoti, non zero; vendite e fatturato ci sono", () => {
    const esito = costruisciAndamentoVenditori({ venditori, ...PERIODO, ghl: ghlOk({ calendariCollegati: false }), mensili: [] });
    expect(esito.righe[0]).toMatchObject({ appuntamentiFissati: null, appuntamentiEffettuati: null, vendite: 2, fatturato: 9000, chiusura: null });
    expect(esito.punti[0].valori.anna).toEqual({ appuntamenti: null, vendite: 0, fatturato: 0 });
  });

  it("mentre GHL risponde: in caricamento, senza numeri; se non risponde: non disponibile", () => {
    const inArrivo = costruisciAndamentoVenditori({ venditori, ...PERIODO, ghl: { stato: "caricamento" }, mensili: [] });
    expect(inArrivo.righe.map((r) => r.disponibilita)).toEqual(["caricamento", "caricamento"]);
    expect(inArrivo.righe[0].vendite).toBeNull();
    expect(inArrivo.statoGrafico).toBe("caricamento");
    expect(inArrivo.punti[0].valori.anna).toBeNull();

    const guasto = costruisciAndamentoVenditori({ venditori, ...PERIODO, ghl: { stato: "errore" }, mensili: [] });
    expect(guasto.righe.map((r) => r.disponibilita)).toEqual(["non-disponibile", "non-disponibile"]);
    expect(guasto.statoGrafico).toBe("non-disponibile");
  });

  it("un venditore che GHL non ha restituito è non disponibile, non a zero", () => {
    const esito = costruisciAndamentoVenditori({ venditori: [...venditori, venditore("nuovo", "u-nuovo")], ...PERIODO, ghl: ghlOk(), mensili: [] });
    expect(esito.righe[2]).toMatchObject({ disponibilita: "non-disponibile", vendite: null });
    expect(esito.punti[0].valori.nuovo).toBeNull();
  });
});

describe("venditori con risultati inseriti a mano", () => {
  const mensili = [
    { mese: "2026-08", venditoreId: "anna", appuntamentiFissati: 5, vendite: 1, fatturato: 4000 },
    { mese: "2026-09", venditoreId: "anna", appuntamentiFissati: 7, vendite: 2, fatturato: 8000 },
    { mese: "2026-09", venditoreId: "luca", appuntamentiFissati: 3, vendite: 0, fatturato: 0 },
  ];
  const venditori = [venditore("anna"), venditore("luca"), venditore("mai")];
  const dueMesi = { da: "2026-08-01", a: "2026-09-30", settimane: ["2026-07-27", "2026-08-03"] };

  it("somma i mesi interi nel periodo; gli appuntamenti effettuati a mano non esistono", () => {
    const { righe } = costruisciAndamentoVenditori({ venditori, ...dueMesi, ghl: { stato: "assente" }, mensili });
    expect(righe[0]).toEqual({ venditoreId: "anna", nome: "ANNA", fonte: "manuale", disponibilita: "ok", appuntamentiFissati: 12, appuntamentiEffettuati: null, vendite: 3, fatturato: 12000, chiusura: 0.25 });
  });

  it("chi non ha nessun mese inserito è non compilato, mai zero", () => {
    const { righe } = costruisciAndamentoVenditori({ venditori, ...dueMesi, ghl: { stato: "assente" }, mensili });
    expect(righe[2]).toMatchObject({ disponibilita: "non-compilato", appuntamentiFissati: null, vendite: null, fatturato: null });
  });

  it("senza venditori da GHL il grafico è a mesi; un mese non inserito è un buco", () => {
    const esito = costruisciAndamentoVenditori({ venditori, ...dueMesi, ghl: { stato: "assente" }, mensili });
    expect(esito.grana).toBe("mese");
    expect(esito.punti.map((p) => p.chiave)).toEqual(["2026-08", "2026-09"]);
    expect(esito.punti.map((p) => p.valori.anna?.appuntamenti)).toEqual([5, 7]);
    expect(esito.punti[0].valori.luca).toBeNull();
    expect(esito.punti[1].valori.luca).toEqual({ appuntamenti: 3, vendite: 0, fatturato: 0 });
    expect(esito.nelGrafico).toEqual(["anna", "luca", "mai"]);
  });

  it("un periodo senza nessun mese intero non ha punti", () => {
    const esito = costruisciAndamentoVenditori({ venditori, ...PERIODO, ghl: { stato: "assente" }, mensili: [] });
    expect(esito.punti).toEqual([]);
  });

  it("l'utente GHL indicato non basta: se la sede non legge da GHL valgono i risultati a mano", () => {
    const { righe } = costruisciAndamentoVenditori({ venditori: [venditore("anna", "u-anna")], ...dueMesi, ghl: { stato: "assente" }, mensili });
    expect(righe[0]).toMatchObject({ fonte: "manuale", appuntamentiFissati: 12 });
  });
});

describe("sede con venditori da GHL e venditori a mano insieme", () => {
  it("il grafico resta a settimane con i soli venditori da GHL; gli altri stanno nella tabella", () => {
    const venditori = [venditore("anna", "u-anna"), venditore("mario")];
    const mensili = [{ mese: "2026-09", venditoreId: "mario", appuntamentiFissati: 4, vendite: 1, fatturato: 2000 }];
    const esito = costruisciAndamentoVenditori({ venditori, da: "2026-09-01", a: "2026-09-30", settimane: SETTIMANE, ghl: ghlOk(), mensili });
    expect(esito.grana).toBe("settimana");
    expect(esito.nelGrafico).toEqual(["anna"]);
    expect(esito.fuoriDalGrafico).toEqual(["mario"]);
    expect(esito.righe[1]).toMatchObject({ fonte: "manuale", disponibilita: "ok", appuntamentiFissati: 4, fatturato: 2000 });
    expect(Object.keys(esito.punti[0].valori)).toEqual(["anna"]);
  });
});
