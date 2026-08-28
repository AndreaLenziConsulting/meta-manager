import { describe, expect, it } from "vitest";
import { scenarioDaDatiReali, type InputScenarioReale } from "./kpiPrevisionale";

function inputBase(overrides: Partial<InputScenarioReale> = {}): InputScenarioReale {
  return {
    investimentoTotalePeriodo: 3000,
    numeroMesiPeriodo: 3,
    numeroLead: 100,
    appuntamentiFissati: 40,
    appuntamentiEffettuati: 20,
    numeroVendite: 5,
    fatturato: 10000,
    ...overrides,
  };
}

describe("scenarioDaDatiReali", () => {
  it("calcola tutti i campi correttamente su un caso a mano", () => {
    const r = scenarioDaDatiReali(inputBase());
    expect(r).toEqual({
      nome: "Sede corrente",
      budgetMensile: 1000, // 3000 / 3
      cpl: 30, // 3000 / 100
      tassoAppuntamento: 40, // (40/100) * 100
      tassoChiusura: 25, // (5/20) * 100
      valoreMedioVendita: 2000, // 10000 / 5
    });
  });

  it("budgetMensile null quando numeroMesiPeriodo e 0", () => {
    const r = scenarioDaDatiReali(inputBase({ numeroMesiPeriodo: 0 }));
    expect(r.budgetMensile).toBeNull();
  });

  it("cpl e tassoAppuntamento null quando numeroLead e 0", () => {
    const r = scenarioDaDatiReali(inputBase({ numeroLead: 0 }));
    expect(r.cpl).toBeNull();
    expect(r.tassoAppuntamento).toBeNull();
  });

  it("tassoChiusura null quando appuntamentiEffettuati e 0", () => {
    const r = scenarioDaDatiReali(inputBase({ appuntamentiEffettuati: 0 }));
    expect(r.tassoChiusura).toBeNull();
  });

  it("valoreMedioVendita null quando numeroVendite e 0", () => {
    const r = scenarioDaDatiReali(inputBase({ numeroVendite: 0 }));
    expect(r.valoreMedioVendita).toBeNull();
  });

  it("tassoAppuntamento e tassoChiusura sono in scala percentuale (0-100), non 0-1", () => {
    // 25 lead su 100 fissati -> rapporto 0.25 -> atteso 25, non 0.25
    const r = scenarioDaDatiReali(
      inputBase({ numeroLead: 100, appuntamentiFissati: 25, appuntamentiEffettuati: 100, numeroVendite: 25 })
    );
    expect(r.tassoAppuntamento).toBe(25);
    expect(r.tassoChiusura).toBe(25);
  });

  it("arrotonda i rapporti (mai una coda di decimali in un campo pensato per essere modificato a mano)", () => {
    // Stesso caso reale osservato dal vivo: 7 fissati su 143 lead -> 4,895104895104895% grezzo.
    const r = scenarioDaDatiReali(
      inputBase({ investimentoTotalePeriodo: 4689, numeroMesiPeriodo: 3, numeroLead: 143, appuntamentiFissati: 7 })
    );
    expect(r.budgetMensile).toBe(1563); // 4689/3 = 1563 esatto, nessun arrotondamento necessario qui
    expect(r.cpl).toBeCloseTo(32.79, 5); // 4689/143 = 32.7895... -> 2 decimali
    expect(r.tassoAppuntamento).toBe(4.9); // (7/143)*100 = 4.895... -> 1 decimale
  });

  it("nome e sempre la stringa fissa 'Sede corrente'", () => {
    const r = scenarioDaDatiReali(inputBase());
    expect(r.nome).toBe("Sede corrente");
  });
});
