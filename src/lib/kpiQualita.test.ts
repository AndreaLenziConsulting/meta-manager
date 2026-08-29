import { describe, expect, it } from "vitest";
import { mesiConSpesaSenzaFunnel } from "./kpiQualita";
import type { Campagna, FunnelRow, MetaDailyRow } from "@/types/kpi";

const CLIENTE = "cliente-1";
const SEDE = "sede-1";

function campagna(overrides: Partial<Campagna> = {}): Campagna {
  return {
    campaignId: "camp-1",
    clienteId: CLIENTE,
    sedeId: SEDE,
    nomeCampagna: "Campagna 1",
    tipoCampagna: "lead",
    stato: "ACTIVE",
    ...overrides,
  };
}

function metaRow(overrides: Partial<MetaDailyRow> = {}): MetaDailyRow {
  return {
    data: "2026-06-15",
    clienteId: CLIENTE,
    campaignId: "camp-1",
    spesa: 100,
    impressions: 1000,
    clicks: 10,
    ctr: 0.01,
    cpc: 10,
    cpm: 100,
    lead: 1,
    clicUniciUscita: 5,
    ...overrides,
  };
}

function funnelRow(overrides: Partial<FunnelRow> = {}): FunnelRow {
  return {
    mese: "2026-06",
    clienteId: CLIENTE,
    sedeId: SEDE,
    tipoCampagna: "lead",
    richieste: 0,
    appuntamentiFissati: 0,
    appuntamentiEffettuati: 0,
    vendite: 0,
    fatturato: 0,
    ...overrides,
  };
}

describe("mesiConSpesaSenzaFunnel", () => {
  it("rileva un mese con spesa ma senza nessuna riga Funnel", () => {
    const campagne = [campagna()];
    const metaDaily = [metaRow({ data: "2026-06-10", spesa: 100 }), metaRow({ data: "2026-06-20", spesa: 50 })];
    const funnel: FunnelRow[] = [];

    const risultato = mesiConSpesaSenzaFunnel(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(risultato).toEqual([{ mese: "2026-06", investimento: 150 }]);
  });

  it("NON segnala un mese che ha una riga Funnel anche se tutti i suoi valori sono 0", () => {
    const campagne = [campagna()];
    const metaDaily = [metaRow({ data: "2026-06-10", spesa: 100 })];
    const funnel = [funnelRow({ mese: "2026-06" })]; // tutti i campi già a 0 di default

    const risultato = mesiConSpesaSenzaFunnel(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(risultato).toEqual([]);
  });

  it("ignora mesi/righe di altre sedi o clienti", () => {
    const campagne = [
      campagna(),
      campagna({ campaignId: "camp-altra-sede", sedeId: "sede-2" }),
      campagna({ campaignId: "camp-altro-cliente", clienteId: "cliente-2", sedeId: SEDE }),
    ];
    const metaDaily = [
      metaRow({ data: "2026-06-10", spesa: 100, campaignId: "camp-1" }),
      metaRow({ data: "2026-06-10", spesa: 999, campaignId: "camp-altra-sede" }),
      metaRow({ data: "2026-06-10", spesa: 999, campaignId: "camp-altro-cliente", clienteId: "cliente-2" }),
    ];
    // Funnel di un'altra sede/cliente per lo stesso mese: non deve coprire il gap della sede target.
    const funnel = [
      funnelRow({ mese: "2026-06", sedeId: "sede-2" }),
      funnelRow({ mese: "2026-06", clienteId: "cliente-2" }),
    ];

    const risultato = mesiConSpesaSenzaFunnel(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(risultato).toEqual([{ mese: "2026-06", investimento: 100 }]);
  });

  it("nessun gap -> array vuoto", () => {
    const campagne = [campagna()];
    const metaDaily = [metaRow({ data: "2026-06-10", spesa: 100 }), metaRow({ data: "2026-07-10", spesa: 200 })];
    const funnel = [funnelRow({ mese: "2026-06" }), funnelRow({ mese: "2026-07" })];

    const risultato = mesiConSpesaSenzaFunnel(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(risultato).toEqual([]);
  });

  it("più mesi con gap -> ordinati cronologicamente", () => {
    const campagne = [campagna()];
    const metaDaily = [
      metaRow({ data: "2026-08-05", spesa: 300 }),
      metaRow({ data: "2026-06-05", spesa: 100 }),
      metaRow({ data: "2026-07-05", spesa: 200 }),
    ];
    const funnel: FunnelRow[] = [];

    const risultato = mesiConSpesaSenzaFunnel(CLIENTE, SEDE, metaDaily, campagne, funnel);

    expect(risultato).toEqual([
      { mese: "2026-06", investimento: 100 },
      { mese: "2026-07", investimento: 200 },
      { mese: "2026-08", investimento: 300 },
    ]);
  });
});
