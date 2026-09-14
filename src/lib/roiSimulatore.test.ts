import { describe, expect, it } from "vitest";
import { calcolaCalcolatoreBudget, calcolaPianoAnnualeBudget, calcolaScenarioRoi } from "./roiSimulatore";
import type { CalcolatoreBudgetInput, ScenarioRoi } from "@/types/prospect";

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

function budgetInput(over: Partial<CalcolatoreBudgetInput>): CalcolatoreBudgetInput {
  return {
    fatturatoMensile: null,
    ticketMedio: null,
    margine: null,
    cpl: null,
    tassoAppuntamento: null,
    tassoChiusura: null,
    variazioneStagionale: null,
    ...over,
  };
}

describe("calcolaCalcolatoreBudget", () => {
  it("risale da fatturato obiettivo a vendite/appuntamenti/lead/budget necessari", () => {
    // 90.000€ / 9.000€ ticket = 10 vendite; 50% chiusura -> 20 appuntamenti; 20% -> 100 lead;
    // 100 x 15€ CPL = 1.500€ di budget; margine 30% -> 27.000€
    const r = calcolaCalcolatoreBudget(
      budgetInput({ fatturatoMensile: 90000, ticketMedio: 9000, margine: 30, cpl: 15, tassoAppuntamento: 20, tassoChiusura: 50 })
    );
    expect(r.numeroVendite).toBe(10);
    expect(r.numeroAppuntamenti).toBe(20);
    expect(r.numeroLead).toBe(100);
    expect(r.budgetMensile).toBe(1500);
    expect(r.margineMensile).toBe(27000);
    expect(r.costoPerAppuntamento).toBe(75); // 1500 / 20
    expect(r.roas).toBe(60); // 90000 / 1500
    expect(r.appuntamentiSettimana).toBeCloseTo(20 / 4.33, 5);
  });

  it("ticket medio a zero o nullo -> tutto a valle resta null, non Infinity/NaN", () => {
    const r = calcolaCalcolatoreBudget(budgetInput({ fatturatoMensile: 90000, ticketMedio: 0, margine: 30, cpl: 15, tassoAppuntamento: 20, tassoChiusura: 50 }));
    expect(r.numeroVendite).toBeNull();
    expect(r.numeroAppuntamenti).toBeNull();
    expect(r.numeroLead).toBeNull();
    expect(r.budgetMensile).toBeNull();
    expect(r.costoPerAppuntamento).toBeNull();
    expect(r.roas).toBeNull();
    // Il margine dipende solo da fatturato*margine%, non dal ticket: resta calcolabile
    expect(r.margineMensile).toBe(27000);
  });

  it("tasso di chiusura a zero -> impossibile chiudere vendite con nessuna conversione, appuntamenti/lead/budget a valle null", () => {
    const r = calcolaCalcolatoreBudget(budgetInput({ fatturatoMensile: 90000, ticketMedio: 9000, cpl: 15, tassoAppuntamento: 20, tassoChiusura: 0 }));
    expect(r.numeroVendite).toBe(10);
    expect(r.numeroAppuntamenti).toBeNull();
    expect(r.numeroLead).toBeNull();
    expect(r.budgetMensile).toBeNull();
  });

  it("cpl a zero -> budget necessario a zero (reale, non un buco nei dati)", () => {
    const r = calcolaCalcolatoreBudget(budgetInput({ fatturatoMensile: 90000, ticketMedio: 9000, cpl: 0, tassoAppuntamento: 20, tassoChiusura: 50 }));
    expect(r.numeroLead).toBe(100);
    expect(r.budgetMensile).toBe(0);
    expect(r.costoPerAppuntamento).toBe(0); // 0 / 20 appuntamenti -> zero reale
    expect(r.roas).toBeNull(); // fatturato / 0 budget -> non divisibile
  });

  it("input completamente vuoto -> tutto null, nessun crash", () => {
    const r = calcolaCalcolatoreBudget(budgetInput({}));
    expect(r).toEqual({
      numeroVendite: null,
      numeroAppuntamenti: null,
      appuntamentiSettimana: null,
      numeroLead: null,
      budgetMensile: null,
      margineMensile: null,
      costoPerAppuntamento: null,
      roas: null,
    });
  });
});

describe("calcolaPianoAnnualeBudget", () => {
  const base = budgetInput({ fatturatoMensile: 90000, ticketMedio: 9000, margine: 30, cpl: 15, tassoAppuntamento: 20, tassoChiusura: 50 });

  it("con variazione stagionale a zero, ogni mese ripete lo scenario base costante", () => {
    const piano = calcolaPianoAnnualeBudget(base);
    expect(piano).toHaveLength(12);
    expect(piano.map((m) => m.mese)).toEqual(["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]);
    for (const m of piano) {
      expect(m.appuntamenti).toBe(20);
      expect(m.vendite).toBe(10);
      expect(m.budget).toBe(1500);
      expect(m.margine).toBe(27000);
    }
    // Fatturato progressivo cumula il fatturato obiettivo costante, non quello stagionato
    expect(piano[0].fatturatoProgressivo).toBe(90000);
    expect(piano[11].fatturatoProgressivo).toBe(90000 * 12);
  });

  it("con variazione stagionale > 0, i mesi si discostano dalla base secondo la curva", () => {
    const piano = calcolaPianoAnnualeBudget({ ...base, variazioneStagionale: 50 });
    const agosto = piano[7]; // coefficiente base 0.75 -> il mese più basso della curva
    const ottobre = piano[9]; // coefficiente base 1.15 -> il mese più alto
    expect(agosto.appuntamenti).toBeLessThan(20);
    expect(ottobre.appuntamenti).toBeGreaterThan(20);
  });

  it("scenario base non calcolabile -> piano vuoto invece di 12 righe a '—'", () => {
    expect(calcolaPianoAnnualeBudget(budgetInput({}))).toEqual([]);
    expect(calcolaPianoAnnualeBudget(budgetInput({ fatturatoMensile: 90000, ticketMedio: 9000, tassoChiusura: 0 }))).toEqual([]);
  });
});
