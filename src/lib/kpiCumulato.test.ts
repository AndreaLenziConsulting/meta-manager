import { describe, expect, it } from "vitest";
import { computeTotaleCumulato, primaDataConDati } from "./kpiCumulato";
import type { Campagna, FunnelRow, MetaDailyRow } from "@/types/kpi";

const CLIENTE = "cliente1";
const SEDE = "sedeA";
const ALTRA_SEDE = "sedeB";
const ALTRO_CLIENTE = "cliente2";

function campagna(overrides: Partial<Campagna> = {}): Campagna {
  return {
    campaignId: "camp1",
    clienteId: CLIENTE,
    sedeId: SEDE,
    nomeCampagna: "Campagna 1",
    tipoCampagna: "Lead Ads",
    stato: "ACTIVE",
    ...overrides,
  };
}

function metaRow(overrides: Partial<MetaDailyRow> = {}): MetaDailyRow {
  return {
    data: "2026-01-10",
    clienteId: CLIENTE,
    campaignId: "camp1",
    spesa: 100,
    impressions: 1000,
    clicks: 50,
    ctr: 5,
    cpc: 2,
    cpm: 100,
    lead: 10,
    clicUniciUscita: 5,
    ...overrides,
  };
}

function funnelRow(overrides: Partial<FunnelRow> = {}): FunnelRow {
  return {
    mese: "2026-01",
    clienteId: CLIENTE,
    sedeId: SEDE,
    tipoCampagna: "Lead Ads",
    richieste: 5,
    appuntamentiFissati: 4,
    appuntamentiEffettuati: 3,
    vendite: 1,
    fatturato: 500,
    ...overrides,
  };
}

describe("primaDataConDati", () => {
  it("trova il minimo tra MetaDaily e Funnel (primo giorno del mese), ignorando altre sedi/clienti", () => {
    const campagne = [campagna({ campaignId: "camp1" }), campagna({ campaignId: "campAltraSede", sedeId: ALTRA_SEDE })];
    const metaDaily = [
      metaRow({ data: "2026-03-15", campaignId: "camp1" }),
      metaRow({ data: "2026-01-20", campaignId: "camp1" }), // la più antica di MetaDaily per questa sede
      metaRow({ data: "2025-01-01", campaignId: "campAltraSede" }), // altra sede, deve essere ignorata
      metaRow({ data: "2025-01-01", clienteId: ALTRO_CLIENTE, campaignId: "camp1" }), // altro cliente, ignorata
    ];
    const funnel = [
      funnelRow({ mese: "2026-02" }), // -> 2026-02-01, più recente del MetaDaily più antico
      funnelRow({ mese: "2024-06", sedeId: ALTRA_SEDE }), // altra sede, ignorata
    ];

    expect(primaDataConDati(CLIENTE, SEDE, metaDaily, campagne, funnel)).toBe("2026-01-20");
  });

  it("il primo giorno del mese Funnel vince quando precede tutte le righe MetaDaily", () => {
    const campagne = [campagna()];
    const metaDaily = [metaRow({ data: "2026-05-01" })];
    const funnel = [funnelRow({ mese: "2026-01" })]; // -> 2026-01-01, precede il MetaDaily

    expect(primaDataConDati(CLIENTE, SEDE, metaDaily, campagne, funnel)).toBe("2026-01-01");
  });

  it("nessuna riga per quella sede in nessuna delle due fonti -> null", () => {
    const campagne = [campagna({ sedeId: ALTRA_SEDE })];
    const metaDaily = [metaRow({ campaignId: "camp1" })];
    const funnel = [funnelRow({ sedeId: ALTRA_SEDE })];

    expect(primaDataConDati(CLIENTE, SEDE, metaDaily, campagne, funnel)).toBeNull();
  });

  it("array vuoti -> null", () => {
    expect(primaDataConDati(CLIENTE, SEDE, [], [], [])).toBeNull();
  });
});

describe("computeTotaleCumulato", () => {
  it("somma tutte le righe della sede indipendentemente da qualunque nozione di periodo", () => {
    const campagne = [campagna({ campaignId: "camp1" }), campagna({ campaignId: "camp2" })];
    const metaDaily = [
      metaRow({ data: "2023-01-01", campaignId: "camp1", spesa: 100, lead: 10 }),
      metaRow({ data: "2026-08-27", campaignId: "camp2", spesa: 50, lead: 5 }), // molto lontana nel tempo dall'altra, deve comunque sommarsi
    ];
    const funnel = [
      funnelRow({ mese: "2023-02", richieste: 5, appuntamentiFissati: 4, appuntamentiEffettuati: 3, vendite: 1, fatturato: 500 }),
      funnelRow({ mese: "2026-08", richieste: 2, appuntamentiFissati: 2, appuntamentiEffettuati: 2, vendite: 1, fatturato: 300 }),
    ];

    const r = computeTotaleCumulato(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(r.tipoCampagna).toBe("Da sempre");
    expect(r.investimento).toBe(150);
    expect(r.numeroLead).toBe(15);
    expect(r.costoPerLead).toBe(150 / 15);
    expect(r.numeroRichieste).toBe(7);
    expect(r.appuntamentiFissati).toBe(6);
    expect(r.appuntamentiEffettuati).toBe(5);
    expect(r.numeroVendite).toBe(2);
    expect(r.fatturato).toBe(800);
    expect(r.costoPerRichiesta).toBe(150 / 7);
    expect(r.percentualeEffettuatiSuFissati).toBe(5 / 6);
    expect(r.costoPerAppuntamentoFissato).toBe(150 / 6);
    expect(r.costoPerAppuntamentoEffettuato).toBe(150 / 5);
    expect(r.tassoDiChiusura).toBe(2 / 5);
    expect(r.roas).toBe(800 / 150);
    expect(r.cpa).toBe(150 / 2);
  });

  it("ignora righe di altre sedi e di altri clienti", () => {
    const campagne = [campagna({ campaignId: "camp1" }), campagna({ campaignId: "campAltraSede", sedeId: ALTRA_SEDE })];
    const metaDaily = [
      metaRow({ campaignId: "camp1", spesa: 100, lead: 10 }),
      metaRow({ campaignId: "campAltraSede", spesa: 999, lead: 999 }),
      metaRow({ clienteId: ALTRO_CLIENTE, campaignId: "camp1", spesa: 999, lead: 999 }),
    ];
    const funnel = [
      funnelRow({ richieste: 5, fatturato: 500 }),
      funnelRow({ sedeId: ALTRA_SEDE, richieste: 999, fatturato: 999999 }),
      funnelRow({ clienteId: ALTRO_CLIENTE, richieste: 999, fatturato: 999999 }),
    ];

    const r = computeTotaleCumulato(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(r.investimento).toBe(100);
    expect(r.numeroLead).toBe(10);
    expect(r.numeroRichieste).toBe(5);
    expect(r.fatturato).toBe(500);
  });

  it("tutti i rapporti derivati sono null quando il denominatore è 0 (nessuna riga per la sede)", () => {
    const r = computeTotaleCumulato(CLIENTE, SEDE, [], [], []);

    expect(r.tipoCampagna).toBe("Da sempre");
    expect(r.investimento).toBe(0);
    expect(r.numeroLead).toBe(0);
    expect(r.costoPerLead).toBeNull();
    expect(r.cpm).toBeNull();
    expect(r.costoPerClicUnico).toBeNull();
    expect(r.ctrClicUnici).toBeNull();
    expect(r.costoPerRichiesta).toBeNull();
    expect(r.percentualeEffettuatiSuFissati).toBeNull();
    expect(r.costoPerAppuntamentoFissato).toBeNull();
    expect(r.costoPerAppuntamentoEffettuato).toBeNull();
    expect(r.tassoDiChiusura).toBeNull();
    expect(r.roas).toBeNull();
    expect(r.cpa).toBeNull();
  });

  it("caso costruito a mano con 2 righe MetaDaily + 2 righe Funnel", () => {
    const campagne = [campagna({ campaignId: "camp1" })];
    const metaDaily = [
      metaRow({ data: "2026-01-05", campaignId: "camp1", spesa: 200, lead: 20 }),
      metaRow({ data: "2026-02-05", campaignId: "camp1", spesa: 300, lead: 10 }),
    ];
    const funnel = [
      funnelRow({ mese: "2026-01", richieste: 15, appuntamentiFissati: 10, appuntamentiEffettuati: 8, vendite: 4, fatturato: 4000 }),
      funnelRow({ mese: "2026-02", richieste: 5, appuntamentiFissati: 5, appuntamentiEffettuati: 4, vendite: 2, fatturato: 2000 }),
    ];

    const r = computeTotaleCumulato(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(r).toEqual({
      tipoCampagna: "Da sempre",
      investimento: 500,
      impressions: 2000, // 1000 (default metaRow) x 2 righe
      cpm: (500 / 2000) * 1000,
      numeroLead: 30,
      costoPerLead: 500 / 30,
      clicUniciUscita: 10, // 5 (default metaRow) x 2 righe
      costoPerClicUnico: 500 / 10,
      ctrClicUnici: 10 / 2000,
      numeroRichieste: 20,
      costoPerRichiesta: 500 / 20,
      appuntamentiFissati: 15,
      appuntamentiEffettuati: 12,
      percentualeEffettuatiSuFissati: 12 / 15,
      costoPerAppuntamentoFissato: 500 / 15,
      costoPerAppuntamentoEffettuato: 500 / 12,
      numeroVendite: 6,
      tassoDiChiusura: 6 / 12,
      fatturato: 6000,
      roas: 6000 / 500,
      cpa: 500 / 6,
    });
  });
});
