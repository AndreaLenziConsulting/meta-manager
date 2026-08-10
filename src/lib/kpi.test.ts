import { describe, expect, it } from "vitest";
import { computeKpi, computeKpiPerCampagna, computeSpesaLeadPeriodo } from "./kpi";
import type { Campagna, FunnelRow, MetaDailyRow } from "@/types/kpi";

const CAMPAGNE: Campagna[] = [
  { campaignId: "c1", clienteId: "alc-01", nomeCampagna: "[Prospecting] A", tipoCampagna: "Prospecting", stato: "ACTIVE" },
  { campaignId: "c2", clienteId: "alc-01", nomeCampagna: "[Prospecting] B", tipoCampagna: "Prospecting", stato: "PAUSED" },
  { campaignId: "c3", clienteId: "alc-01", nomeCampagna: "[Retargeting] C", tipoCampagna: "Retargeting", stato: "ACTIVE" },
  { campaignId: "c9", clienteId: "altro-cliente", nomeCampagna: "[Prospecting] X", tipoCampagna: "Prospecting", stato: "ACTIVE" },
];

const META_DAILY: MetaDailyRow[] = [
  { data: "2026-06-15", clienteId: "alc-01", campaignId: "c1", spesa: 100, impressions: 1000, clicks: 10, ctr: 1, cpc: 10, cpm: 100, lead: 5 },
  { data: "2026-06-16", clienteId: "alc-01", campaignId: "c2", spesa: 50, impressions: 500, clicks: 5, ctr: 1, cpc: 10, cpm: 100, lead: 2 },
  { data: "2026-06-20", clienteId: "alc-01", campaignId: "c3", spesa: 200, impressions: 2000, clicks: 20, ctr: 1, cpc: 10, cpm: 100, lead: 8 },
  { data: "2026-07-01", clienteId: "alc-01", campaignId: "c1", spesa: 30, impressions: 300, clicks: 3, ctr: 1, cpc: 10, cpm: 100, lead: 1 },
  // Fuori dal periodo di test [2026-06, 2026-06]: deve essere escluso quando si filtra a giugno.
  { data: "2026-05-01", clienteId: "alc-01", campaignId: "c1", spesa: 999, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 99 },
  // Altro cliente: non deve mai comparire nei totali di alc-01.
  { data: "2026-06-15", clienteId: "altro-cliente", campaignId: "c9", spesa: 500, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 50 },
];

const FUNNEL: FunnelRow[] = [
  { mese: "2026-06", clienteId: "alc-01", tipoCampagna: "Prospecting", richieste: 10, appuntamentiFissati: 6, appuntamentiEffettuati: 4, vendite: 2, fatturato: 4000 },
  { mese: "2026-06", clienteId: "alc-01", tipoCampagna: "Retargeting", richieste: 3, appuntamentiFissati: 2, appuntamentiEffettuati: 1, vendite: 0, fatturato: 0 },
];

describe("computeKpi", () => {
  it("aggrega investimento/lead per tipo_campagna nel periodo richiesto", () => {
    const { gruppi } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL);
    const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
    const retargeting = gruppi.find((g) => g.tipoCampagna === "Retargeting")!;

    expect(prospecting.investimento).toBe(150); // c1 (100) + c2 (50), non c1 di luglio né maggio
    expect(prospecting.numeroLead).toBe(7);
    expect(retargeting.investimento).toBe(200);
    expect(retargeting.numeroLead).toBe(8);
  });

  it("esclude righe fuori dal range di mesi e di altri clienti", () => {
    const { totale } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL);
    // 999 (maggio) e 500 (altro cliente) non devono contribuire.
    expect(totale.investimento).toBe(350);
  });

  it("unisce i dati Funnel (richieste/appuntamenti/vendite/fatturato) allo stesso tipo_campagna", () => {
    const { gruppi } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL);
    const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
    expect(prospecting.numeroRichieste).toBe(10);
    expect(prospecting.numeroVendite).toBe(2);
    expect(prospecting.fatturato).toBe(4000);
  });

  it("calcola le formule derivate correttamente, incluso il caso divisione per zero -> null", () => {
    const { totale } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL);
    expect(totale.costoPerLead).toBeCloseTo(350 / 15, 5);
    expect(totale.cpa).toBeCloseTo(350 / 2, 5); // 2 vendite in totale

    const vuoto = computeKpi("alc-01", "2099-01", "2099-01", META_DAILY, CAMPAGNE, FUNNEL);
    expect(vuoto.totale.costoPerLead).toBeNull();
    expect(vuoto.totale.roas).toBeNull();
    expect(vuoto.totale.cpa).toBeNull();
  });

  it("un periodo di più mesi copre correttamente l'intervallo inclusivo", () => {
    const { totale } = computeKpi("alc-01", "2026-06", "2026-07", META_DAILY, CAMPAGNE, FUNNEL);
    expect(totale.investimento).toBe(380); // 350 di giugno + 30 di luglio
  });

  it("il trend mensile somma investimento (da MetaDaily) e fatturato (da Funnel) per mese", () => {
    const { trend } = computeKpi("alc-01", "2026-06", "2026-07", META_DAILY, CAMPAGNE, FUNNEL);
    const giugno = trend.find((t) => t.mese === "2026-06")!;
    const luglio = trend.find((t) => t.mese === "2026-07")!;
    expect(giugno.investimento).toBe(350);
    expect(giugno.fatturato).toBe(4000);
    expect(luglio.investimento).toBe(30);
    expect(luglio.fatturato).toBe(0); // nessuna riga Funnel per luglio nel fixture
  });

  it("il trend settimanale usa il lunedì della settimana come chiave, coerente a cavallo di mese", () => {
    // 2026-06-15 è un lunedì; 2026-06-16 martedì della stessa settimana; 2026-06-20 sabato, stessa settimana.
    const { trendSettimanale } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL);
    expect(trendSettimanale).toEqual([{ settimana: "2026-06-15", investimento: 350 }]);
  });

  describe("filtro campagneSelezionate", () => {
    it("limita MetaDaily alle sole campagne selezionate", () => {
      const { totale } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL, new Set(["c1"]));
      expect(totale.investimento).toBe(100); // solo c1 di giugno
    });

    it("un tipo_campagna con ALMENO una campagna selezionata mantiene INTERO il suo Funnel (non è divisibile per campagna)", () => {
      // Seleziono solo c2 (Prospecting): Funnel di Prospecting deve restare intero (10 richieste),
      // anche se c1 (anch'essa Prospecting) è esclusa dal filtro.
      const { gruppi } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL, new Set(["c2"]));
      const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
      expect(prospecting.investimento).toBe(50); // solo c2
      expect(prospecting.numeroRichieste).toBe(10); // Funnel intero comunque
    });

    it("un tipo_campagna con NESSUNA campagna selezionata non porta il suo Funnel", () => {
      const { gruppi } = computeKpi("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, FUNNEL, new Set(["c3"]));
      const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting");
      expect(prospecting).toBeUndefined();
    });
  });
});

describe("computeKpiPerCampagna", () => {
  it("produce una riga per campagna con le sole metriche Meta (non Funnel)", () => {
    const righe = computeKpiPerCampagna("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE);
    const c1 = righe.find((r) => r.campaignId === "c1")!;
    expect(c1.investimento).toBe(100);
    expect(c1.numeroLead).toBe(5);
    expect(c1.costoPerLead).toBe(20);
    expect(c1.tipoCampagna).toBe("Prospecting");
    expect(c1.stato).toBe("ACTIVE");
  });

  it("ordina per investimento decrescente", () => {
    const righe = computeKpiPerCampagna("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE);
    const investimenti = righe.map((r) => r.investimento);
    expect(investimenti).toEqual([...investimenti].sort((a, b) => b - a));
  });

  it("include statoDal quando è disponibile una mappa di ultimo cambio, null se assente", () => {
    const ultimoCambio = new Map([["c1", "2026-06-10T05:00:00.000Z"]]);
    const righe = computeKpiPerCampagna("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE, undefined, ultimoCambio);
    const c1 = righe.find((r) => r.campaignId === "c1")!;
    const c2 = righe.find((r) => r.campaignId === "c2")!;
    expect(c1.statoDal).toBe("2026-06-10T05:00:00.000Z");
    expect(c2.statoDal).toBeNull();

    const senzaMappa = computeKpiPerCampagna("alc-01", "2026-06", "2026-06", META_DAILY, CAMPAGNE);
    expect(senzaMappa.every((r) => r.statoDal === null)).toBe(true);
  });

  it("una campagna con spesa ma non mappata in Campagne usa fallback ragionevoli", () => {
    const rigaNonMappata: MetaDailyRow = {
      data: "2026-06-01",
      clienteId: "alc-01",
      campaignId: "sconosciuta",
      spesa: 10,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      lead: 0,
    };
    const righe = computeKpiPerCampagna("alc-01", "2026-06", "2026-06", [...META_DAILY, rigaNonMappata], CAMPAGNE);
    const riga = righe.find((r) => r.campaignId === "sconosciuta")!;
    expect(riga.nomeCampagna).toBe("sconosciuta");
    expect(riga.tipoCampagna).toBe("Non classificata");
    expect(riga.stato).toBe("");
    expect(riga.costoPerLead).toBeNull(); // 0 lead -> divisione per zero -> null, non 0 o Infinity
  });
});

describe("computeSpesaLeadPeriodo", () => {
  it("somma su un range di date reali (non mesi interi)", () => {
    const r = computeSpesaLeadPeriodo("alc-01", "2026-06-14", "2026-06-16", META_DAILY);
    expect(r.investimento).toBe(150); // c1 (15/06) + c2 (16/06)
    expect(r.numeroLead).toBe(7);
    expect(r.costoPerLead).toBeCloseTo(150 / 7, 5);
  });

  it("nessun dato nel range -> costoPerLead null, non NaN", () => {
    const r = computeSpesaLeadPeriodo("alc-01", "2099-01-01", "2099-01-31", META_DAILY);
    expect(r.investimento).toBe(0);
    expect(r.numeroLead).toBe(0);
    expect(r.costoPerLead).toBeNull();
  });
});
