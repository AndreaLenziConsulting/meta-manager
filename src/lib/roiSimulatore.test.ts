import { describe, expect, it } from "vitest";
import { calcolaScenarioRoi } from "./roiSimulatore";
import type { ScenarioRoi } from "@/types/prospect";

function scenario(over: Partial<ScenarioRoi>): ScenarioRoi {
  return {
    nome: "Scenario",
    budgetMensile: null,
    cpl: null,
    tassoAppuntamento: null,
    tassoChiusura: null,
    valoreMedioVendita: null,
    ...over,
  };
}

describe("calcolaScenarioRoi", () => {
  it("proietta lead/appuntamenti/vendite/fatturato dai tassi attesi", () => {
    // 1000€ / 25€ CPL = 40 lead; 50% -> 20 appuntamenti; 25% -> 5 vendite; 5 x 2000€ = 10.000€
    const r = calcolaScenarioRoi(
      scenario({ budgetMensile: 1000, cpl: 25, tassoAppuntamento: 50, tassoChiusura: 25, valoreMedioVendita: 2000 })
    );
    expect(r.numeroLead).toBe(40);
    expect(r.numeroAppuntamenti).toBe(20);
    expect(r.numeroVendite).toBe(5);
    expect(r.fatturatoAtteso).toBe(10000);
    expect(r.cpa).toBe(200); // 1000 / 5
    expect(r.roas).toBe(10); // 10000 / 1000
  });

  it("cpl a zero o nullo -> tutto a valle resta null, non Infinity/NaN", () => {
    const r = calcolaScenarioRoi(scenario({ budgetMensile: 1000, cpl: 0, tassoAppuntamento: 50, tassoChiusura: 25, valoreMedioVendita: 2000 }));
    expect(r.numeroLead).toBeNull();
    expect(r.numeroAppuntamenti).toBeNull();
    expect(r.numeroVendite).toBeNull();
    expect(r.fatturatoAtteso).toBeNull();
    expect(r.cpa).toBeNull();
    expect(r.roas).toBeNull();
  });

  it("tassi di conversione a zero -> zero vendite/fatturato/roas (numeri reali, non un buco nei dati)", () => {
    const r = calcolaScenarioRoi(scenario({ budgetMensile: 1000, cpl: 25, tassoAppuntamento: 0, tassoChiusura: 25, valoreMedioVendita: 2000 }));
    expect(r.numeroLead).toBe(40);
    expect(r.numeroAppuntamenti).toBe(0);
    expect(r.numeroVendite).toBe(0);
    expect(r.fatturatoAtteso).toBe(0);
    expect(r.cpa).toBeNull(); // budget / 0 vendite -> non divisibile, non "infinito"
    expect(r.roas).toBe(0); // 0 fatturato / 1000 budget -> zero reale, il budget stesso non è nullo
  });

  it("budget a zero -> cpa/roas null (sono proprio budget o vendite a fare da denominatore, entrambi 0)", () => {
    const r = calcolaScenarioRoi(scenario({ budgetMensile: 0, cpl: 25, tassoAppuntamento: 50, tassoChiusura: 25, valoreMedioVendita: 2000 }));
    expect(r.numeroLead).toBe(0); // 0€ di budget / 25€ CPL -> zero lead attesi, non un dato mancante
    expect(r.cpa).toBeNull();
    expect(r.roas).toBeNull();
  });

  it("input completamente vuoto -> tutto null, nessun crash", () => {
    const r = calcolaScenarioRoi(scenario({}));
    expect(r).toEqual({
      numeroLead: null,
      numeroAppuntamenti: null,
      numeroVendite: null,
      cpa: null,
      fatturatoAtteso: null,
      roas: null,
    });
  });
});
