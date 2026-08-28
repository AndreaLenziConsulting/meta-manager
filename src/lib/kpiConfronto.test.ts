import { describe, expect, it } from "vitest";
import {
  calcolaRigaMedia,
  funnelPerMese,
  serieCostoMensileRipetutaPerSettimana,
  trovaSediMigliori,
  type RigaConfrontoSede,
} from "./kpiConfronto";
import type { FunnelRow } from "@/types/kpi";

describe("calcolaRigaMedia", () => {
  it("volumi come media aritmetica semplice, rapporti come totale-su-totale (diverso dalla media ingenua dei rapporti-per-sede)", () => {
    const sedeA: RigaConfrontoSede = {
      sedeId: "s1",
      nome: "Sede A",
      investimento: 100,
      numeroLead: 50,
      costoPerLead: 2, // 100/50
      appuntamentiFissati: 40,
      appuntamentiEffettuati: 20,
      percentualeEffettuatiSuFissati: 0.5, // 20/40
      numeroVendite: 4,
      tassoDiChiusura: 0.2, // 4/20
      fatturato: 300,
      roas: 3, // 300/100
      cpa: 25, // 100/4
    };
    const sedeB: RigaConfrontoSede = {
      sedeId: "s2",
      nome: "Sede B",
      investimento: 300,
      numeroLead: 60,
      costoPerLead: 5, // 300/60
      appuntamentiFissati: 30,
      appuntamentiEffettuati: 25,
      percentualeEffettuatiSuFissati: 25 / 30,
      numeroVendite: 20,
      tassoDiChiusura: 0.8, // 20/25
      fatturato: 150,
      roas: 0.5, // 150/300
      cpa: 15, // 300/20
    };

    const media = calcolaRigaMedia([sedeA, sedeB]);

    expect(media.sedeId).toBe("media");
    expect(media.nome).toBe("Media");

    // Volumi: media aritmetica semplice (somma/N).
    expect(media.investimento).toBe(200); // (100+300)/2
    expect(media.numeroLead).toBe(55); // (50+60)/2
    expect(media.appuntamentiFissati).toBe(35); // (40+30)/2
    expect(media.appuntamentiEffettuati).toBe(22.5); // (20+25)/2
    expect(media.numeroVendite).toBe(12); // (4+20)/2
    expect(media.fatturato).toBe(225); // (300+150)/2

    // Rapporti: totale-su-totale sulle somme grezze.
    expect(media.costoPerLead).toBe(400 / 110);
    expect(media.percentualeEffettuatiSuFissati).toBe(45 / 70);
    expect(media.tassoDiChiusura).toBe(24 / 45);
    expect(media.roas).toBe(450 / 400);
    expect(media.cpa).toBe(400 / 24);

    // Punto cruciale: NON è la media dei rapporti già calcolati per singola sede (i pesi per sede
    // sono diversi, quindi le due strade danno risultati numericamente diversi).
    expect(media.costoPerLead).not.toBeCloseTo((sedeA.costoPerLead! + sedeB.costoPerLead!) / 2);
    expect(media.percentualeEffettuatiSuFissati).not.toBeCloseTo(
      (sedeA.percentualeEffettuatiSuFissati! + sedeB.percentualeEffettuatiSuFissati!) / 2
    );
    expect(media.tassoDiChiusura).not.toBeCloseTo((sedeA.tassoDiChiusura! + sedeB.tassoDiChiusura!) / 2);
    expect(media.roas).not.toBeCloseTo((sedeA.roas! + sedeB.roas!) / 2);
    expect(media.cpa).not.toBeCloseTo((sedeA.cpa! + sedeB.cpa!) / 2);
  });
});

describe("trovaSediMigliori", () => {
  it("direzione min: pareggio esatto fra 2 sedi -> ritorna entrambe", () => {
    const righe = [
      { sedeId: "s1", valore: 10 },
      { sedeId: "s2", valore: 10 },
      { sedeId: "s3", valore: 20 },
    ];
    expect(trovaSediMigliori(righe, "min")).toEqual(["s1", "s2"]);
  });

  it("tutte le righe null -> ritorna []", () => {
    const righe = [
      { sedeId: "s1", valore: null },
      { sedeId: "s2", valore: null },
    ];
    expect(trovaSediMigliori(righe, "max")).toEqual([]);
  });

  it("direzione max: un chiaro vincitore, ignora i valori null", () => {
    const righe = [
      { sedeId: "s1", valore: 5 },
      { sedeId: "s2", valore: null },
      { sedeId: "s3", valore: 9 },
    ];
    expect(trovaSediMigliori(righe, "max")).toEqual(["s3"]);
  });
});

describe("funnelPerMese", () => {
  const FUNNEL: FunnelRow[] = [
    { mese: "2026-06", clienteId: "c1", sedeId: "s1", tipoCampagna: "A", richieste: 10, appuntamentiFissati: 5, appuntamentiEffettuati: 3, vendite: 1, fatturato: 100 },
    { mese: "2026-06", clienteId: "c1", sedeId: "s1", tipoCampagna: "B", richieste: 3, appuntamentiFissati: 2, appuntamentiEffettuati: 1, vendite: 0, fatturato: 0 },
    // altra sede dello stesso cliente nello stesso mese -> deve essere ignorata
    { mese: "2026-06", clienteId: "c1", sedeId: "s2", tipoCampagna: "A", richieste: 99, appuntamentiFissati: 99, appuntamentiEffettuati: 99, vendite: 99, fatturato: 9999 },
    // altro mese, stessa sede -> entry separata
    { mese: "2026-07", clienteId: "c1", sedeId: "s1", tipoCampagna: "A", richieste: 1, appuntamentiFissati: 1, appuntamentiEffettuati: 1, vendite: 1, fatturato: 50 },
    // altro cliente, stessa sedeId -> deve essere ignorata
    { mese: "2026-06", clienteId: "c2", sedeId: "s1", tipoCampagna: "A", richieste: 50, appuntamentiFissati: 50, appuntamentiEffettuati: 50, vendite: 50, fatturato: 5000 },
  ];

  it("somma più righe Funnel dello stesso mese/sede (tipoCampagna diversi) e ignora altre sedi/clienti", () => {
    const mappa = funnelPerMese("c1", "s1", FUNNEL);

    expect(mappa.size).toBe(2);
    expect(mappa.get("2026-06")).toEqual({ appuntamentiFissati: 7, appuntamentiEffettuati: 4, numeroVendite: 1 });
    expect(mappa.get("2026-07")).toEqual({ appuntamentiFissati: 1, appuntamentiEffettuati: 1, numeroVendite: 1 });
  });
});

describe("serieCostoMensileRipetutaPerSettimana", () => {
  it("null per un mese senza riga Funnel (anche se il mese esiste in trendMensile); valore mensile ripetuto identico su ogni settimana quando il Funnel c'è; null anche se il mese manca da trendMensile", () => {
    const trendSettimanale = [
      { settimana: "2026-06-01", mese: "2026-06" },
      { settimana: "2026-06-08", mese: "2026-06" },
      { settimana: "2026-07-06", mese: "2026-07" }, // "2026-07" non ha riga Funnel
      { settimana: "2026-08-03", mese: "2026-08" }, // "2026-08" ha Funnel ma non è in trendMensile
    ];
    const trendMensile = [
      { mese: "2026-06", investimento: 400 },
      { mese: "2026-07", investimento: 100 },
    ];
    const funnelPerMeseMap = new Map([
      ["2026-06", { appuntamentiFissati: 8, appuntamentiEffettuati: 4, numeroVendite: 2 }],
      ["2026-08", { appuntamentiFissati: 10, appuntamentiEffettuati: 5, numeroVendite: 3 }],
    ]);

    const serie = serieCostoMensileRipetutaPerSettimana(trendSettimanale, trendMensile, funnelPerMeseMap, "appuntamentiFissati");

    expect(serie).toEqual([
      { settimana: "2026-06-01", valore: 50 }, // 400/8
      { settimana: "2026-06-08", valore: 50 }, // stesso valore mensile ripetuto
      { settimana: "2026-07-06", valore: null }, // "2026-07" non ha riga Funnel
      { settimana: "2026-08-03", valore: null }, // "2026-08" non ha investimento in trendMensile
    ]);
  });
});
