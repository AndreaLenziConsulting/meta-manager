import { describe, expect, it } from "vitest";
import { calcolaCostoPerRisultatoSettimanale } from "./costoPerRisultatoSettimanale";

describe("calcolaCostoPerRisultatoSettimanale", () => {
  it("calcola spesa, costo per lead, costo per appuntamento e CAC (costo per vendita) per settimana", () => {
    const punti = calcolaCostoPerRisultatoSettimanale([
      { settimana: "2026-06-01", investimento: 400, numeroLead: 8, appuntamentiFissati: 4, numeroVendite: 2 },
    ]);
    expect(punti).toEqual([{ settimana: "2026-06-01", spesa: 400, costoPerLead: 50, costoPerAppuntamento: 100, costoPerVendita: 200 }]);
  });

  it("denominatore a 0 -> null (mai una divisione per zero), non un dato Funnel mancante", () => {
    const punti = calcolaCostoPerRisultatoSettimanale([
      { settimana: "2026-06-01", investimento: 400, numeroLead: 0, appuntamentiFissati: 0, numeroVendite: 0 },
    ]);
    expect(punti[0].costoPerLead).toBeNull();
    expect(punti[0].costoPerAppuntamento).toBeNull();
    expect(punti[0].costoPerVendita).toBeNull();
  });

  it("denominatore null (mese senza dato Funnel per quella settimana) -> null, non tratta null come 0", () => {
    const punti = calcolaCostoPerRisultatoSettimanale([
      { settimana: "2026-06-01", investimento: 400, numeroLead: 5, appuntamentiFissati: null, numeroVendite: null },
    ]);
    expect(punti[0].costoPerAppuntamento).toBeNull();
    expect(punti[0].costoPerVendita).toBeNull();
  });

  it("numeroLead non è mai nullable (arriva da Meta, non dal Funnel): sempre un numero, mai un buco", () => {
    const punti = calcolaCostoPerRisultatoSettimanale([
      { settimana: "2026-06-01", investimento: 300, numeroLead: 3, appuntamentiFissati: null, numeroVendite: null },
    ]);
    expect(punti[0].costoPerLead).toBe(100);
  });

  it("mantiene l'ordine e la spesa di ogni settimana della serie in ingresso", () => {
    const punti = calcolaCostoPerRisultatoSettimanale([
      { settimana: "2026-06-01", investimento: 100, numeroLead: 2, appuntamentiFissati: 1, numeroVendite: 1 },
      { settimana: "2026-06-08", investimento: 200, numeroLead: 4, appuntamentiFissati: 2, numeroVendite: 1 },
    ]);
    expect(punti.map((p) => p.settimana)).toEqual(["2026-06-01", "2026-06-08"]);
    expect(punti.map((p) => p.spesa)).toEqual([100, 200]);
  });
});
