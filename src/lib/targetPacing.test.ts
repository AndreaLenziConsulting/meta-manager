import { describe, expect, it } from "vitest";
import { calcolaPacingMensile } from "./targetPacing";

const BASE = {
  investimentoMese: 0,
  fatturatoMese: 0,
  leadMese: 0,
  appuntamentiMese: 0,
  targetBudgetMensile: null,
  targetFatturatoMensile: null,
  targetLeadSettimana: null,
  targetAppuntamentiSettimana: null,
  giornoDelMese: 15,
  giorniNelMese: 30,
};

describe("calcolaPacingMensile", () => {
  it("a metà mese, esattamente al ritmo atteso -> successo", () => {
    const [m] = calcolaPacingMensile({ ...BASE, targetBudgetMensile: 1000, investimentoMese: 500 });
    expect(m.attesoOggi).toBe(500);
    expect(m.stato).toBe("successo");
  });

  it("oltre il ritmo atteso -> successo", () => {
    const [m] = calcolaPacingMensile({ ...BASE, targetBudgetMensile: 1000, investimentoMese: 600 });
    expect(m.stato).toBe("successo");
  });

  it("tra 80% e 100% del ritmo atteso -> attenzione", () => {
    const [m] = calcolaPacingMensile({ ...BASE, targetBudgetMensile: 1000, investimentoMese: 450 }); // 450/500 = 90%
    expect(m.stato).toBe("attenzione");
  });

  it("sotto l'80% del ritmo atteso -> critico", () => {
    const [m] = calcolaPacingMensile({ ...BASE, targetBudgetMensile: 1000, investimentoMese: 300 }); // 300/500 = 60%
    expect(m.stato).toBe("critico");
  });

  it("un target null non genera una riga", () => {
    const risultato = calcolaPacingMensile({ ...BASE, targetBudgetMensile: null });
    expect(risultato.find((m) => m.chiave === "budget")).toBeUndefined();
  });

  it("un target a zero (o negativo) non genera una riga, come null", () => {
    const risultato = calcolaPacingMensile({ ...BASE, targetBudgetMensile: 0 });
    expect(risultato.find((m) => m.chiave === "budget")).toBeUndefined();
  });

  it("nessun target impostato -> array vuoto", () => {
    expect(calcolaPacingMensile(BASE)).toEqual([]);
  });

  it("converte il target settimanale (lead/appuntamenti) in equivalente mensile via giorniNelMese/7", () => {
    const [m] = calcolaPacingMensile({ ...BASE, targetLeadSettimana: 7, giorniNelMese: 28, leadMese: 0 });
    // 7 lead/settimana * (28/7) settimane = 28 lead/mese
    expect(m.targetMensile).toBe(28);
  });

  it("a inizio mese (giorno 0 teorico) non segnala mai critico solo per l'assenza di tempo trascorso", () => {
    const [m] = calcolaPacingMensile({ ...BASE, giornoDelMese: 0, targetBudgetMensile: 1000, investimentoMese: 0 });
    expect(m.attesoOggi).toBe(0);
    expect(m.stato).toBe("attenzione");
  });

  it("restituisce solo le metriche con un target impostato, nell'ordine budget/fatturato/lead/appuntamenti", () => {
    const risultato = calcolaPacingMensile({
      ...BASE,
      targetFatturatoMensile: 5000,
      targetAppuntamentiSettimana: 3,
      fatturatoMese: 2000,
      appuntamentiMese: 5,
    });
    expect(risultato.map((m) => m.chiave)).toEqual(["fatturato", "appuntamenti"]);
  });
});
