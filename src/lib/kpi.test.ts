import { describe, expect, it } from "vitest";
import { computeKpi, computeKpiPerCampagna, computeSpesaLeadPeriodo, isPeriodoMensile, meseDiPeriodo } from "./kpi";
import type { Campagna, RisultatoCommercialeRow, MetaDailyRow } from "@/types/kpi";

const SEDE = "s1";

const CAMPAGNE: Campagna[] = [
  { campaignId: "c1", clienteId: "alc-01", sedeId: SEDE, nomeCampagna: "[Prospecting] A", tipoCampagna: "Prospecting", stato: "ACTIVE" },
  { campaignId: "c2", clienteId: "alc-01", sedeId: SEDE, nomeCampagna: "[Prospecting] B", tipoCampagna: "Prospecting", stato: "PAUSED" },
  { campaignId: "c3", clienteId: "alc-01", sedeId: SEDE, nomeCampagna: "[Retargeting] C", tipoCampagna: "Retargeting", stato: "ACTIVE" },
  { campaignId: "c9", clienteId: "altro-cliente", sedeId: "altra-sede", nomeCampagna: "[Prospecting] X", tipoCampagna: "Prospecting", stato: "ACTIVE" },
];

const META_DAILY: MetaDailyRow[] = [
  { data: "2026-06-15", clienteId: "alc-01", campaignId: "c1", spesa: 100, impressions: 1000, clicks: 10, ctr: 1, cpc: 10, cpm: 100, lead: 5, clicLink: 0 },
  { data: "2026-06-16", clienteId: "alc-01", campaignId: "c2", spesa: 50, impressions: 500, clicks: 5, ctr: 1, cpc: 10, cpm: 100, lead: 2, clicLink: 0 },
  { data: "2026-06-20", clienteId: "alc-01", campaignId: "c3", spesa: 200, impressions: 2000, clicks: 20, ctr: 1, cpc: 10, cpm: 100, lead: 8, clicLink: 0 },
  { data: "2026-07-01", clienteId: "alc-01", campaignId: "c1", spesa: 30, impressions: 300, clicks: 3, ctr: 1, cpc: 10, cpm: 100, lead: 1, clicLink: 0 },
  // Fuori dal periodo di test [2026-06, 2026-06]: deve essere escluso quando si filtra a giugno.
  { data: "2026-05-01", clienteId: "alc-01", campaignId: "c1", spesa: 999, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 99, clicLink: 0 },
  // Altro cliente: non deve mai comparire nei totali di alc-01.
  { data: "2026-06-15", clienteId: "altro-cliente", campaignId: "c9", spesa: 500, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 50, clicLink: 0 },
];

const RISULTATI_COMMERCIALI: RisultatoCommercialeRow[] = [
  { periodo: "2026-06", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 10, appuntamentiFissati: 6, appuntamentiEffettuati: 4, vendite: 2, fatturato: 4000 },
  { periodo: "2026-06", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Retargeting", richieste: 3, appuntamentiFissati: 2, appuntamentiEffettuati: 1, vendite: 0, fatturato: 0 },
];

describe("isPeriodoMensile / meseDiPeriodo", () => {
  it("un periodo a 7 caratteri è un mese, a 10 caratteri è una settimana", () => {
    expect(isPeriodoMensile("2026-06")).toBe(true);
    expect(isPeriodoMensile("2026-06-15")).toBe(false);
  });

  it("meseDiPeriodo torna il periodo stesso per un mese, il mese del lunedì per una settimana", () => {
    expect(meseDiPeriodo("2026-06")).toBe("2026-06");
    expect(meseDiPeriodo("2026-06-15")).toBe("2026-06");
    expect(meseDiPeriodo("2026-06-29")).toBe("2026-06"); // settimana a cavallo -> il mese è quello del lunedì, non di domenica (2026-07-05)
  });
});

describe("computeKpi", () => {
  it("aggrega investimento/lead per tipo_campagna nel periodo richiesto", () => {
    const { gruppi } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
    const retargeting = gruppi.find((g) => g.tipoCampagna === "Retargeting")!;

    expect(prospecting.investimento).toBe(150); // c1 (100) + c2 (50), non c1 di luglio né maggio
    expect(prospecting.numeroLead).toBe(7);
    expect(retargeting.investimento).toBe(200);
    expect(retargeting.numeroLead).toBe(8);
  });

  it("aggrega impressions/clic sul link e calcola i derivati (cpm, costo/clic, ctr link) dall'aggregato, mai media dei valori giornalieri", () => {
    const metaDaily: MetaDailyRow[] = [
      { data: "2026-06-01", clienteId: "alc-01", campaignId: "c1", spesa: 100, impressions: 2000, clicks: 50, ctr: 2.5, cpc: 2, cpm: 50, lead: 5, clicLink: 20 },
      { data: "2026-06-02", clienteId: "alc-01", campaignId: "c1", spesa: 50, impressions: 1000, clicks: 25, ctr: 2.5, cpc: 2, cpm: 50, lead: 3, clicLink: 10 },
    ];
    const { gruppi, totale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", metaDaily, CAMPAGNE, []);
    const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
    expect(prospecting.impressions).toBe(3000);
    expect(prospecting.clicLink).toBe(30);
    expect(prospecting.cpm).toBeCloseTo((150 / 3000) * 1000, 5); // 50 — ricalcolato dall'aggregato, non la media dei due cpm giornalieri (identici qui per costruzione, ma il punto è che non sono quelli letti)
    expect(prospecting.costoPerClic).toBeCloseTo(150 / 30, 5);
    expect(prospecting.ctrClicLink).toBeCloseTo(30 / 3000, 5);
    expect(totale.impressions).toBe(3000);
    expect(totale.clicLink).toBe(30);
  });

  it("cpm/costo-per-clic/ctr-link sono null quando il denominatore è 0 (nessuna impression/clic)", () => {
    const metaDaily: MetaDailyRow[] = [
      { data: "2026-06-01", clienteId: "alc-01", campaignId: "c1", spesa: 100, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, lead: 0, clicLink: 0 },
    ];
    const { totale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", metaDaily, CAMPAGNE, []);
    expect(totale.cpm).toBeNull();
    expect(totale.costoPerClic).toBeNull();
    expect(totale.ctrClicLink).toBeNull();
  });

  it("esclude righe fuori dal range di mesi e di altri clienti", () => {
    const { totale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    // 999 (maggio) e 500 (altro cliente) non devono contribuire.
    expect(totale.investimento).toBe(350);
  });

  it("unisce i dati RisultatiCommerciali (richieste/appuntamenti/vendite/fatturato) allo stesso tipo_campagna", () => {
    const { gruppi } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
    expect(prospecting.numeroRichieste).toBe(10);
    expect(prospecting.numeroVendite).toBe(2);
    expect(prospecting.fatturato).toBe(4000);
  });

  it("calcola le formule derivate correttamente, incluso il caso divisione per zero -> null", () => {
    const { totale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    expect(totale.costoPerLead).toBeCloseTo(350 / 15, 5);
    expect(totale.cpa).toBeCloseTo(350 / 2, 5); // 2 vendite in totale

    const vuoto = computeKpi("alc-01", SEDE, "2099-01", "2099-01", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    expect(vuoto.totale.costoPerLead).toBeNull();
    expect(vuoto.totale.roas).toBeNull();
    expect(vuoto.totale.cpa).toBeNull();
  });

  it("un periodo di più mesi copre correttamente l'intervallo inclusivo", () => {
    const { totale } = computeKpi("alc-01", SEDE, "2026-06", "2026-07", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    expect(totale.investimento).toBe(380); // 350 di giugno + 30 di luglio
  });

  it("il trend mensile somma investimento (da MetaDaily) e fatturato (da RisultatiCommerciali) per mese", () => {
    const { trend } = computeKpi("alc-01", SEDE, "2026-06", "2026-07", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    const giugno = trend.find((t) => t.mese === "2026-06")!;
    const luglio = trend.find((t) => t.mese === "2026-07")!;
    expect(giugno.investimento).toBe(350);
    expect(giugno.fatturato).toBe(4000);
    expect(giugno.numeroLead).toBe(15); // 5 (c1) + 2 (c2) + 8 (c3)
    expect(luglio.investimento).toBe(30);
    expect(luglio.fatturato).toBe(0); // nessuna riga RisultatiCommerciali per luglio nel fixture
    expect(luglio.numeroLead).toBe(1);
  });

  it("il trend settimanale copre l'intera griglia di settimane del mese, comprese quelle senza spesa reale", () => {
    // 2026-06-01 è un lunedì -> la griglia di giugno 2026 è esattamente 5 lunedì (01/08/15/22/29).
    // 2026-06-15 è un lunedì; 2026-06-16 martedì della stessa settimana; 2026-06-20 sabato, stessa settimana:
    // solo quella settimana ha investimento/lead reali, le altre 4 sono placeholder (0, ma fatturato comunque
    // presente: RisultatiCommerciali è mensile, si ripete per ogni settimana del mese).
    const { trendSettimanale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    // RISULTATI_COMMERCIALI di giugno: Prospecting (fissati 6, effettuati 4, vendite 2) + Retargeting (fissati 2,
    // effettuati 1, vendite 0) = 8/5/2 in totale, ripetuti su ogni settimana come il fatturato.
    expect(trendSettimanale).toEqual([
      { settimana: "2026-06-01", investimento: 0, fatturato: 4000, numeroLead: 0, appuntamentiFissati: 8, appuntamentiEffettuati: 5, numeroVendite: 2, mese: "2026-06" },
      { settimana: "2026-06-08", investimento: 0, fatturato: 4000, numeroLead: 0, appuntamentiFissati: 8, appuntamentiEffettuati: 5, numeroVendite: 2, mese: "2026-06" },
      { settimana: "2026-06-15", investimento: 350, fatturato: 4000, numeroLead: 15, appuntamentiFissati: 8, appuntamentiEffettuati: 5, numeroVendite: 2, mese: "2026-06" },
      { settimana: "2026-06-22", investimento: 0, fatturato: 4000, numeroLead: 0, appuntamentiFissati: 8, appuntamentiEffettuati: 5, numeroVendite: 2, mese: "2026-06" },
      { settimana: "2026-06-29", investimento: 0, fatturato: 4000, numeroLead: 0, appuntamentiFissati: 8, appuntamentiEffettuati: 5, numeroVendite: 2, mese: "2026-06" },
    ]);
  });

  it("una settimana a cavallo di due mesi riporta il fatturato del mese con più spesa in quella settimana, e la griglia copre l'intero range a cavallo", () => {
    // Settimana del lunedì 2026-06-29 (fino a domenica 2026-07-05): il lunedì stesso è di giugno, ma la
    // spesa reale in quella settimana è quasi tutta di luglio -> il fatturato deve seguire la spesa, non il lunedì.
    const metaDaily: MetaDailyRow[] = [
      { data: "2026-06-29", clienteId: "alc-01", campaignId: "c1", spesa: 10, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 1, clicLink: 0 },
      { data: "2026-07-01", clienteId: "alc-01", campaignId: "c1", spesa: 90, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 9, clicLink: 0 },
    ];
    const risultatiCommerciali: RisultatoCommercialeRow[] = [
      { periodo: "2026-06", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 1000 },
      { periodo: "2026-07", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 5000 },
    ];
    const { trendSettimanale } = computeKpi("alc-01", SEDE, "2026-06", "2026-07", metaDaily, CAMPAGNE, risultatiCommerciali);

    const settimana = trendSettimanale.find((t) => t.settimana === "2026-06-29")!;
    expect(settimana.investimento).toBe(100);
    expect(settimana.numeroLead).toBe(10);
    expect(settimana.fatturato).toBe(5000); // luglio (90 di spesa) batte giugno (10 di spesa)

    // 9 lunedì da 2026-06-01 a 2026-07-27 (2026-07-31, ultimo giorno di luglio, è nella settimana del 27) —
    // non solo le 2 settimane con righe MetaDaily reali (bug segnalato: "agosto ne ha solo 1??").
    expect(trendSettimanale.map((t) => t.settimana)).toEqual([
      "2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29",
      "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27",
    ]);
    const placeholder = trendSettimanale.find((t) => t.settimana === "2026-06-01")!;
    expect(placeholder).toEqual({
      settimana: "2026-06-01",
      investimento: 0,
      fatturato: 1000,
      numeroLead: 0,
      appuntamentiFissati: 0,
      appuntamentiEffettuati: 0,
      numeroVendite: 0,
      mese: "2026-06",
    });
  });

  describe("RisultatoCommercialeRow.periodo a livello di settimana (selettore periodo a settimane, 25/09/2026)", () => {
    it("una riga già a settimana (periodo a 10 caratteri, un lunedì) va SOLO in quella settimana, mai spalmata sulle altre settimane dello stesso mese", () => {
      // 2026-06-15 è un lunedì. Nessuna riga MENSILE per giugno: solo quella settimana ha un dato
      // reale, le altre settimane di giugno restano a null (nessun dato, non uno zero inventato) —
      // dimostra che il dato diretto non "fuoriesce" verso le settimane sorelle.
      const risultatiCommerciali: RisultatoCommercialeRow[] = [
        { periodo: "2026-06-15", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 3, appuntamentiEffettuati: 2, vendite: 1, fatturato: 1500 },
      ];
      const { trendSettimanale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, risultatiCommerciali);

      const settimana15 = trendSettimanale.find((t) => t.settimana === "2026-06-15")!;
      expect(settimana15.fatturato).toBe(1500);
      expect(settimana15.appuntamentiFissati).toBe(3);
      expect(settimana15.numeroVendite).toBe(1);

      const settimana01 = trendSettimanale.find((t) => t.settimana === "2026-06-01")!;
      expect(settimana01.fatturato).toBeNull(); // nessuna riga diretta e nessuna riga mensile per giugno -> dato assente, non 0
      expect(settimana01.appuntamentiFissati).toBeNull();
    });

    it("una riga a settimana E una riga mensile nello stesso mese: il totale del mese le somma entrambe, ma la spalmatura sulle altre settimane usa SOLO la riga mensile (mai il dato reale della settimana migrata)", () => {
      // Scenario di transizione: una settimana già migrata convive con il resto del mese ancora a
      // riga unica. Il totale del mese (gruppi/trend) è la somma vera di entrambe le righe — ma le
      // ALTRE settimane (senza riga diretta propria) devono continuare a mostrare solo il vecchio
      // dato mensile spalmato (4000), MAI il dato reale della settimana 15 travestito da media
      // mensile: quel numero appartiene solo alla settimana 15.
      const risultatiCommerciali: RisultatoCommercialeRow[] = [
        { periodo: "2026-06", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 4000 },
        { periodo: "2026-06-15", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 3, appuntamentiEffettuati: 2, vendite: 1, fatturato: 1500 },
      ];
      const { gruppi, trendSettimanale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, risultatiCommerciali);

      const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
      expect(prospecting.fatturato).toBe(5500); // 4000 (mensile) + 1500 (settimanale) sommati, mai persi

      const settimana15 = trendSettimanale.find((t) => t.settimana === "2026-06-15")!;
      expect(settimana15.fatturato).toBe(1500); // il dato DIRETTO di quella settimana, non il totale mensile

      const settimana01 = trendSettimanale.find((t) => t.settimana === "2026-06-01")!;
      expect(settimana01.fatturato).toBe(4000); // solo la riga mensile, mai 4000+1500: quel 1500 è già mostrato sulla sua settimana
    });

    it("una riga a settimana confluisce comunque nel gruppo/trend del mese del suo lunedì, in una query a mese", () => {
      const risultatiCommerciali: RisultatoCommercialeRow[] = [
        { periodo: "2026-06-15", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 5, appuntamentiFissati: 3, appuntamentiEffettuati: 2, vendite: 1, fatturato: 1500 },
      ];
      const { gruppi, trend } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, risultatiCommerciali);
      const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
      expect(prospecting.fatturato).toBe(1500);
      expect(prospecting.numeroVendite).toBe(1);

      const giugno = trend.find((t) => t.mese === "2026-06")!;
      expect(giugno.fatturato).toBe(1500);

      // Una settimana il cui lunedì cade FUORI dal mese richiesto non deve comparire.
      const vuoto = computeKpi("alc-01", SEDE, "2026-07", "2026-07", META_DAILY, CAMPAGNE, risultatiCommerciali);
      expect(vuoto.totale.fatturato).toBe(0);
    });

    it("più righe settimanali (tipoCampagna diverse) per la stessa settimana si sommano, mai l'ultima sovrascrive", () => {
      const risultatiCommerciali: RisultatoCommercialeRow[] = [
        { periodo: "2026-06-15", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 1, appuntamentiEffettuati: 1, vendite: 1, fatturato: 1000 },
        { periodo: "2026-06-15", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Retargeting", richieste: 0, appuntamentiFissati: 2, appuntamentiEffettuati: 1, vendite: 0, fatturato: 500 },
      ];
      const { trendSettimanale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, risultatiCommerciali);
      const settimana15 = trendSettimanale.find((t) => t.settimana === "2026-06-15")!;
      expect(settimana15.fatturato).toBe(1500);
      expect(settimana15.appuntamentiFissati).toBe(3);
    });
  });

  describe("computeKpi con da/a a livello di settimana (modalità settimana del selettore periodo, 25/09/2026)", () => {
    it("filtra MetaDaily su un range di giorni reale, non sull'intero mese", () => {
      // 2026-06-15 è un lunedì; la settimana finisce domenica 2026-06-21. META_DAILY ha righe il
      // 15/16/20 giugno (dentro la settimana) e altre fuori (01 luglio, 01 maggio, altro cliente).
      const { totale } = computeKpi("alc-01", SEDE, "2026-06-15", "2026-06-15", META_DAILY, CAMPAGNE, []);
      expect(totale.investimento).toBe(350); // 100 (c1, 15/06) + 50 (c2, 16/06) + 200 (c3, 20/06)
    });

    it("un intervallo di più settimane copre il range corretto, escludendo la settimana successiva", () => {
      const metaDaily: MetaDailyRow[] = [
        { data: "2026-06-29", clienteId: "alc-01", campaignId: "c1", spesa: 10, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 1, clicLink: 0 },
        { data: "2026-07-01", clienteId: "alc-01", campaignId: "c1", spesa: 90, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 9, clicLink: 0 }, // stessa settimana di 06-29
        { data: "2026-07-06", clienteId: "alc-01", campaignId: "c1", spesa: 999, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 1, clicLink: 0 }, // settimana successiva, fuori
      ];
      const { totale } = computeKpi("alc-01", SEDE, "2026-06-29", "2026-06-29", metaDaily, CAMPAGNE, []);
      expect(totale.investimento).toBe(100); // 10 + 90, non 999
    });

    it("una riga RisultatoCommercialeRow ancora mensile viene esclusa (mai un dato indovinato a livello di settimana)", () => {
      const risultatiCommerciali: RisultatoCommercialeRow[] = [
        { periodo: "2026-06", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 10, appuntamentiFissati: 6, appuntamentiEffettuati: 4, vendite: 2, fatturato: 4000 },
      ];
      const { totale, gruppi } = computeKpi("alc-01", SEDE, "2026-06-15", "2026-06-15", META_DAILY, CAMPAGNE, risultatiCommerciali);
      expect(totale.fatturato).toBe(0); // la riga mensile non conta in modalità settimana
      expect(gruppi.find((g) => g.tipoCampagna === "Prospecting")?.fatturato ?? 0).toBe(0);
    });

    it("una riga già a settimana dentro il range richiesto viene inclusa, una fuori range no", () => {
      const risultatiCommerciali: RisultatoCommercialeRow[] = [
        { periodo: "2026-06-15", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 5, appuntamentiFissati: 3, appuntamentiEffettuati: 2, vendite: 1, fatturato: 1500 },
        { periodo: "2026-06-22", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 1, appuntamentiFissati: 1, appuntamentiEffettuati: 1, vendite: 1, fatturato: 999 },
      ];
      const { totale } = computeKpi("alc-01", SEDE, "2026-06-15", "2026-06-15", META_DAILY, CAMPAGNE, risultatiCommerciali);
      expect(totale.fatturato).toBe(1500); // solo la settimana richiesta, non 999 dell'altra
    });

    it("un intervallo di più settimane somma solo le righe settimanali comprese nel range", () => {
      const risultatiCommerciali: RisultatoCommercialeRow[] = [
        { periodo: "2026-06-01", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 100 },
        { periodo: "2026-06-08", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 200 },
        { periodo: "2026-06-15", clienteId: "alc-01", sedeId: SEDE, tipoCampagna: "Prospecting", richieste: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 400 }, // fuori range
      ];
      const { totale } = computeKpi("alc-01", SEDE, "2026-06-01", "2026-06-08", META_DAILY, CAMPAGNE, risultatiCommerciali);
      expect(totale.fatturato).toBe(300); // 100 + 200, non 400
    });
  });

  it("un periodo senza nessuna riga MetaDaily/RisultatiCommerciali produce comunque una griglia completa di settimane, fatturato null", () => {
    // Riproduce esattamente il bug segnalato ("agosto un solo punto"): prima di questo fix, un mese
    // senza nessuna riga MetaDaily reale avrebbe restituito un array vuoto, non una griglia completa.
    const { trendSettimanale } = computeKpi("alc-01", SEDE, "2026-08", "2026-08", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI);
    expect(trendSettimanale).toEqual([
      { settimana: "2026-07-27", investimento: 0, fatturato: null, numeroLead: 0, appuntamentiFissati: null, appuntamentiEffettuati: null, numeroVendite: null, mese: "2026-07" },
      { settimana: "2026-08-03", investimento: 0, fatturato: null, numeroLead: 0, appuntamentiFissati: null, appuntamentiEffettuati: null, numeroVendite: null, mese: "2026-08" },
      { settimana: "2026-08-10", investimento: 0, fatturato: null, numeroLead: 0, appuntamentiFissati: null, appuntamentiEffettuati: null, numeroVendite: null, mese: "2026-08" },
      { settimana: "2026-08-17", investimento: 0, fatturato: null, numeroLead: 0, appuntamentiFissati: null, appuntamentiEffettuati: null, numeroVendite: null, mese: "2026-08" },
      { settimana: "2026-08-24", investimento: 0, fatturato: null, numeroLead: 0, appuntamentiFissati: null, appuntamentiEffettuati: null, numeroVendite: null, mese: "2026-08" },
      { settimana: "2026-08-31", investimento: 0, fatturato: null, numeroLead: 0, appuntamentiFissati: null, appuntamentiEffettuati: null, numeroVendite: null, mese: "2026-08" },
    ]);
  });

  describe("filtro campagneSelezionate", () => {
    it("limita MetaDaily alle sole campagne selezionate", () => {
      const { totale } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI, new Set(["c1"]));
      expect(totale.investimento).toBe(100); // solo c1 di giugno
    });

    it("un tipo_campagna con ALMENO una campagna selezionata mantiene INTERO il suo RisultatiCommerciali (non è divisibile per campagna)", () => {
      // Seleziono solo c2 (Prospecting): RisultatiCommerciali di Prospecting deve restare intero
      // (10 richieste), anche se c1 (anch'essa Prospecting) è esclusa dal filtro.
      const { gruppi } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI, new Set(["c2"]));
      const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
      expect(prospecting.investimento).toBe(50); // solo c2
      expect(prospecting.numeroRichieste).toBe(10); // RisultatiCommerciali intero comunque
    });

    it("un tipo_campagna con NESSUNA campagna selezionata non porta il suo RisultatiCommerciali", () => {
      const { gruppi } = computeKpi("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, RISULTATI_COMMERCIALI, new Set(["c3"]));
      const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting");
      expect(prospecting).toBeUndefined();
    });
  });

  describe("isolamento tra sedi dello stesso cliente", () => {
    // Stesso clienteId, due sedi con account (quindi campagne) diversi: spesa/lead/risultati
    // commerciali di una sede non devono mai comparire nei numeri dell'altra — il caso critico
    // introdotto con Sede.
    const campagneDueSedi: Campagna[] = [
      { campaignId: "s1-c1", clienteId: "multi", sedeId: "sede-1", nomeCampagna: "Sede 1", tipoCampagna: "Prospecting", stato: "ACTIVE" },
      { campaignId: "s2-c1", clienteId: "multi", sedeId: "sede-2", nomeCampagna: "Sede 2", tipoCampagna: "Prospecting", stato: "ACTIVE" },
    ];
    const metaDailyDueSedi: MetaDailyRow[] = [
      { data: "2026-06-10", clienteId: "multi", campaignId: "s1-c1", spesa: 100, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 10, clicLink: 0 },
      { data: "2026-06-10", clienteId: "multi", campaignId: "s2-c1", spesa: 500, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 50, clicLink: 0 },
    ];
    const risultatiCommercialiDueSedi: RisultatoCommercialeRow[] = [
      { periodo: "2026-06", clienteId: "multi", sedeId: "sede-1", tipoCampagna: "Prospecting", richieste: 1, appuntamentiFissati: 1, appuntamentiEffettuati: 1, vendite: 1, fatturato: 1000 },
      { periodo: "2026-06", clienteId: "multi", sedeId: "sede-2", tipoCampagna: "Prospecting", richieste: 9, appuntamentiFissati: 9, appuntamentiEffettuati: 9, vendite: 9, fatturato: 9000 },
    ];

    it("computeKpi vede solo la spesa/lead/risultati commerciali della sede richiesta", () => {
      const sede1 = computeKpi("multi", "sede-1", "2026-06", "2026-06", metaDailyDueSedi, campagneDueSedi, risultatiCommercialiDueSedi);
      const sede2 = computeKpi("multi", "sede-2", "2026-06", "2026-06", metaDailyDueSedi, campagneDueSedi, risultatiCommercialiDueSedi);

      expect(sede1.totale.investimento).toBe(100);
      expect(sede1.totale.numeroLead).toBe(10);
      expect(sede1.totale.fatturato).toBe(1000);

      expect(sede2.totale.investimento).toBe(500);
      expect(sede2.totale.numeroLead).toBe(50);
      expect(sede2.totale.fatturato).toBe(9000);
    });
  });
});

describe("computeKpiPerCampagna", () => {
  it("produce una riga per campagna con le sole metriche Meta (non RisultatiCommerciali)", () => {
    const righe = computeKpiPerCampagna("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE);
    const c1 = righe.find((r) => r.campaignId === "c1")!;
    expect(c1.investimento).toBe(100);
    expect(c1.numeroLead).toBe(5);
    expect(c1.costoPerLead).toBe(20);
    expect(c1.tipoCampagna).toBe("Prospecting");
    expect(c1.stato).toBe("ACTIVE");
  });

  it("aggrega impressions/clic sul link per singola campagna e calcola cpm/costo-clic/ctr-link", () => {
    const metaDaily: MetaDailyRow[] = [
      { data: "2026-06-01", clienteId: "alc-01", campaignId: "c1", spesa: 100, impressions: 2000, clicks: 50, ctr: 2.5, cpc: 2, cpm: 50, lead: 5, clicLink: 20 },
      { data: "2026-06-02", clienteId: "alc-01", campaignId: "c1", spesa: 50, impressions: 1000, clicks: 25, ctr: 2.5, cpc: 2, cpm: 50, lead: 3, clicLink: 10 },
    ];
    const righe = computeKpiPerCampagna("alc-01", SEDE, "2026-06", "2026-06", metaDaily, CAMPAGNE);
    const c1 = righe.find((r) => r.campaignId === "c1")!;
    expect(c1.impressions).toBe(3000);
    expect(c1.clicLink).toBe(30);
    expect(c1.cpm).toBeCloseTo((150 / 3000) * 1000, 5);
    expect(c1.costoPerClic).toBeCloseTo(150 / 30, 5);
    expect(c1.ctrClicLink).toBeCloseTo(30 / 3000, 5);
  });

  it("ordina per investimento decrescente", () => {
    const righe = computeKpiPerCampagna("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE);
    const investimenti = righe.map((r) => r.investimento);
    expect(investimenti).toEqual([...investimenti].sort((a, b) => b - a));
  });

  it("le campagne attive vengono sempre prima di quelle non attive, anche se investono meno — non solo per investimento decrescente", () => {
    // c2 (PAUSED) investe piu' di c1 e c3 (entrambe ACTIVE): senza la regola attiva-prima-di-tutto
    // finirebbe comunque per prima per puro investimento — qui deve restare per ultima.
    const metaDaily: MetaDailyRow[] = [
      { data: "2026-06-01", clienteId: "alc-01", campaignId: "c1", spesa: 50, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 1, clicLink: 0 },
      { data: "2026-06-01", clienteId: "alc-01", campaignId: "c2", spesa: 999, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 1, clicLink: 0 },
      { data: "2026-06-01", clienteId: "alc-01", campaignId: "c3", spesa: 30, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 1, clicLink: 0 },
    ];
    const righe = computeKpiPerCampagna("alc-01", SEDE, "2026-06", "2026-06", metaDaily, CAMPAGNE);
    expect(righe.map((r) => r.campaignId)).toEqual(["c1", "c3", "c2"]); // c1/c3 ACTIVE (per investimento), c2 PAUSED per ultima nonostante investa di piu'
  });

  it("include statoDal quando è disponibile una mappa di ultimo cambio, null se assente", () => {
    const ultimoCambio = new Map([["c1", "2026-06-10T05:00:00.000Z"]]);
    const righe = computeKpiPerCampagna("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE, undefined, ultimoCambio);
    const c1 = righe.find((r) => r.campaignId === "c1")!;
    const c2 = righe.find((r) => r.campaignId === "c2")!;
    expect(c1.statoDal).toBe("2026-06-10T05:00:00.000Z");
    expect(c2.statoDal).toBeNull();

    const senzaMappa = computeKpiPerCampagna("alc-01", SEDE, "2026-06", "2026-06", META_DAILY, CAMPAGNE);
    expect(senzaMappa.every((r) => r.statoDal === null)).toBe(true);
  });

  it("con da/a a livello di settimana, filtra su un range di giorni reale (modalità settimana, 25/09/2026)", () => {
    const righe = computeKpiPerCampagna("alc-01", SEDE, "2026-06-15", "2026-06-15", META_DAILY, CAMPAGNE);
    const c1 = righe.find((r) => r.campaignId === "c1")!;
    expect(c1.investimento).toBe(100); // solo 15/06, non anche 01/07
  });

  it("una campagna con spesa ma non mappata in Campagne (o mappata su un'altra sede) viene esclusa, non mostrata con fallback", () => {
    // Scelta deliberata dopo l'introduzione di Sede: senza una mappatura non c'è modo di sapere a
    // quale sede attribuire la spesa, quindi resta fuori dalla vista sede-scoped finché il sync non
    // la mappa (stato transitorio, non il regime normale) — non più "Non classificata ma inclusa".
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
      clicLink: 0,
    };
    const righe = computeKpiPerCampagna("alc-01", SEDE, "2026-06", "2026-06", [...META_DAILY, rigaNonMappata], CAMPAGNE);
    expect(righe.find((r) => r.campaignId === "sconosciuta")).toBeUndefined();
  });
});

describe("computeSpesaLeadPeriodo", () => {
  it("somma su un range di date reali (non mesi interi)", () => {
    const r = computeSpesaLeadPeriodo("alc-01", SEDE, "2026-06-14", "2026-06-16", META_DAILY, CAMPAGNE);
    expect(r.investimento).toBe(150); // c1 (15/06) + c2 (16/06)
    expect(r.numeroLead).toBe(7);
    expect(r.costoPerLead).toBeCloseTo(150 / 7, 5);
  });

  it("nessun dato nel range -> costoPerLead null, non NaN", () => {
    const r = computeSpesaLeadPeriodo("alc-01", SEDE, "2099-01-01", "2099-01-31", META_DAILY, CAMPAGNE);
    expect(r.investimento).toBe(0);
    expect(r.numeroLead).toBe(0);
    expect(r.costoPerLead).toBeNull();
  });
});

// Test di regressione per la Fase 1 del redesign multi-canale (12/09/2026): Meta Ads e Google Ads
// generano entrambi campaignId puramente numerici — senza la chiave composita canale::campaignId
// (vedi chiaveCampagna in kpi.ts), due campagne di canali diversi con lo stesso campaignId (per
// quanto improbabile) si fonderebbero silenziosamente in una sola voce.
describe("isolamento tra canali con lo stesso campaignId", () => {
  const campagneDueCanali: Campagna[] = [
    { campaignId: "999", clienteId: "multi-canale", sedeId: SEDE, nomeCampagna: "Meta", tipoCampagna: "Prospecting", stato: "ACTIVE", canale: "meta" },
    { campaignId: "999", clienteId: "multi-canale", sedeId: SEDE, nomeCampagna: "Google", tipoCampagna: "Retargeting", stato: "ACTIVE", canale: "google" },
  ];
  const metaDailyDueCanali: MetaDailyRow[] = [
    { data: "2026-06-10", clienteId: "multi-canale", campaignId: "999", canale: "meta", spesa: 100, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 10, clicLink: 0 },
    { data: "2026-06-10", clienteId: "multi-canale", campaignId: "999", canale: "google", spesa: 500, impressions: 1, clicks: 1, ctr: 1, cpc: 1, cpm: 1, lead: 50, clicLink: 0 },
  ];

  it("computeKpi aggrega le due campagne nei rispettivi tipo_campagna, mai fuse insieme", () => {
    const { gruppi } = computeKpi("multi-canale", SEDE, "2026-06", "2026-06", metaDailyDueCanali, campagneDueCanali, []);
    const prospecting = gruppi.find((g) => g.tipoCampagna === "Prospecting")!;
    const retargeting = gruppi.find((g) => g.tipoCampagna === "Retargeting")!;
    expect(prospecting.investimento).toBe(100); // solo la riga Meta
    expect(prospecting.numeroLead).toBe(10);
    expect(retargeting.investimento).toBe(500); // solo la riga Google Ads
    expect(retargeting.numeroLead).toBe(50);
  });

  it("computeKpiPerCampagna produce due righe distinte, una per canale, mai una sola sommata", () => {
    const righe = computeKpiPerCampagna("multi-canale", SEDE, "2026-06", "2026-06", metaDailyDueCanali, campagneDueCanali);
    expect(righe).toHaveLength(2);
    const meta = righe.find((r) => r.canale === "meta")!;
    const google = righe.find((r) => r.canale === "google")!;
    expect(meta.investimento).toBe(100);
    expect(meta.tipoCampagna).toBe("Prospecting");
    expect(google.investimento).toBe(500);
    expect(google.tipoCampagna).toBe("Retargeting");
  });

  it("computeSpesaLeadPeriodo somma solo la riga del canale corretto per ciascuna campagna", () => {
    const r = computeSpesaLeadPeriodo("multi-canale", SEDE, "2026-06-01", "2026-06-30", metaDailyDueCanali, campagneDueCanali);
    expect(r.investimento).toBe(600); // 100 (meta) + 500 (google), entrambe valide per la sede
    expect(r.numeroLead).toBe(60);
  });
});
