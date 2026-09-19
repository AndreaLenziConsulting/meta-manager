import { describe, expect, it } from "vitest";
import { aggregaRisultatiVenditori, calcolaQuoteVenditori } from "./venditori";
import type { RisultatoVenditoreRow, Venditore } from "@/types/kpi";

function riga(overrides: Partial<RisultatoVenditoreRow> = {}): RisultatoVenditoreRow {
  return {
    mese: "2026-09",
    sedeId: "sede-1",
    venditoreId: "v1",
    appuntamentiFissati: 0,
    vendite: 0,
    fatturato: 0,
    ...overrides,
  };
}

function venditore(overrides: Partial<Venditore> = {}): Venditore {
  return { venditoreId: "v1", sedeId: "sede-1", nome: "Mario", capienzaAppuntamentiMensile: 10, attivo: true, ghlUserId: "", ...overrides };
}

describe("aggregaRisultatiVenditori", () => {
  it("somma più righe dello stesso venditore nello stesso mese", () => {
    const righe = [
      riga({ appuntamentiFissati: 3, vendite: 1, fatturato: 500 }),
      riga({ appuntamentiFissati: 2, vendite: 0, fatturato: 0 }),
    ];
    const mappa = aggregaRisultatiVenditori(righe, "sede-1", "2026-09", "2026-09");
    expect(mappa.get("v1")).toEqual({ appuntamentiFissati: 5, vendite: 1, fatturato: 500 });
  });

  it("ignora righe di un'altra sede", () => {
    const righe = [riga({ sedeId: "sede-2", appuntamentiFissati: 99 })];
    const mappa = aggregaRisultatiVenditori(righe, "sede-1", "2026-09", "2026-09");
    expect(mappa.size).toBe(0);
  });

  it("ignora righe fuori dal periodo da/a", () => {
    const righe = [riga({ mese: "2026-08", appuntamentiFissati: 5 }), riga({ mese: "2026-10", appuntamentiFissati: 7 })];
    const mappa = aggregaRisultatiVenditori(righe, "sede-1", "2026-09", "2026-09");
    expect(mappa.size).toBe(0);
  });

  it("tiene venditori diversi su chiavi separate", () => {
    const righe = [riga({ venditoreId: "v1", appuntamentiFissati: 3 }), riga({ venditoreId: "v2", appuntamentiFissati: 4 })];
    const mappa = aggregaRisultatiVenditori(righe, "sede-1", "2026-09", "2026-09");
    expect(mappa.get("v1")?.appuntamentiFissati).toBe(3);
    expect(mappa.get("v2")?.appuntamentiFissati).toBe(4);
  });

  it("nessuna riga -> mappa vuota, mai una entry a zero inventata", () => {
    const mappa = aggregaRisultatiVenditori([], "sede-1", "2026-09", "2026-09");
    expect(mappa.size).toBe(0);
  });
});

describe("calcolaQuoteVenditori", () => {
  it("divide proporzionalmente alla capienza dichiarata", () => {
    const venditori = [venditore({ venditoreId: "v1", capienzaAppuntamentiMensile: 30 }), venditore({ venditoreId: "v2", capienzaAppuntamentiMensile: 10 })];
    const quote = calcolaQuoteVenditori(venditori);
    expect(quote.get("v1")).toBeCloseTo(0.75);
    expect(quote.get("v2")).toBeCloseTo(0.25);
  });

  it("esclude i venditori non attivi dal calcolo", () => {
    const venditori = [
      venditore({ venditoreId: "v1", capienzaAppuntamentiMensile: 10, attivo: true }),
      venditore({ venditoreId: "v2", capienzaAppuntamentiMensile: 90, attivo: false }),
    ];
    const quote = calcolaQuoteVenditori(venditori);
    expect(quote.get("v1")).toBe(1);
    expect(quote.has("v2")).toBe(false);
  });

  it("capienza totale zero -> mappa vuota, mai una divisione per zero", () => {
    const venditori = [venditore({ capienzaAppuntamentiMensile: 0 })];
    const quote = calcolaQuoteVenditori(venditori);
    expect(quote.size).toBe(0);
  });

  it("nessun venditore attivo -> mappa vuota", () => {
    const quote = calcolaQuoteVenditori([venditore({ attivo: false })]);
    expect(quote.size).toBe(0);
  });
});
