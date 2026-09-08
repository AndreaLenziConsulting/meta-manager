import { describe, expect, it } from "vitest";
import { confrontaTargetCommerciali } from "./targetCommerciali";

const INPUT_BASE = {
  targetBudgetMensile: null,
  targetLeadSettimana: null,
  targetAppuntamentiSettimana: null,
  targetFatturatoMensile: null,
  investimentoPeriodo: 0,
  fatturatoPeriodo: 0,
  numeroMesiPeriodo: 1,
  serieSettimanale: [],
};

describe("confrontaTargetCommerciali", () => {
  it("nessun target impostato -> tutti i confronti null, non un errore", () => {
    expect(confrontaTargetCommerciali(INPUT_BASE)).toEqual({
      budgetMensile: null,
      leadSettimana: null,
      appuntamentiSettimana: null,
      fatturatoMensile: null,
    });
  });

  it("budget mensile: effettivo è il totale del periodo diviso per il numero di mesi", () => {
    const risultato = confrontaTargetCommerciali({
      ...INPUT_BASE,
      targetBudgetMensile: 500,
      investimentoPeriodo: 1000,
      numeroMesiPeriodo: 2,
    });
    expect(risultato.budgetMensile).toEqual({ atteso: 500, effettivo: 500 });
  });

  it("fatturato mensile: stesso schema del budget, sul totale fatturato del periodo", () => {
    const risultato = confrontaTargetCommerciali({
      ...INPUT_BASE,
      targetFatturatoMensile: 10000,
      fatturatoPeriodo: 30000,
      numeroMesiPeriodo: 3,
    });
    expect(risultato.fatturatoMensile).toEqual({ atteso: 10000, effettivo: 10000 });
  });

  it("lead a settimana: effettivo è la media della serie settimanale", () => {
    const risultato = confrontaTargetCommerciali({
      ...INPUT_BASE,
      targetLeadSettimana: 10,
      serieSettimanale: [
        { numeroLead: 8, appuntamentiFissati: null },
        { numeroLead: 12, appuntamentiFissati: null },
      ],
    });
    expect(risultato.leadSettimana).toEqual({ atteso: 10, effettivo: 10 });
  });

  it("appuntamenti a settimana: ignora le settimane senza dato Funnel (null) invece di annullare tutto", () => {
    const risultato = confrontaTargetCommerciali({
      ...INPUT_BASE,
      targetAppuntamentiSettimana: 5,
      serieSettimanale: [
        { numeroLead: 0, appuntamentiFissati: 4 },
        { numeroLead: 0, appuntamentiFissati: null }, // mese senza Funnel
        { numeroLead: 0, appuntamentiFissati: 6 },
      ],
    });
    expect(risultato.appuntamentiSettimana).toEqual({ atteso: 5, effettivo: 5 }); // media di 4 e 6, non di 4/0/6
  });

  it("appuntamenti a settimana: tutte le settimane senza dato -> nessun confronto (non 0)", () => {
    const risultato = confrontaTargetCommerciali({
      ...INPUT_BASE,
      targetAppuntamentiSettimana: 5,
      serieSettimanale: [{ numeroLead: 0, appuntamentiFissati: null }],
    });
    expect(risultato.appuntamentiSettimana).toBeNull();
  });

  it("serie settimanale vuota -> lead/appuntamenti null (nessun dato su cui fare la media)", () => {
    const risultato = confrontaTargetCommerciali({ ...INPUT_BASE, targetLeadSettimana: 10, targetAppuntamentiSettimana: 5 });
    expect(risultato.leadSettimana).toBeNull();
    expect(risultato.appuntamentiSettimana).toBeNull();
  });

  it("numeroMesiPeriodo <= 0 -> tratta come 1 mese, mai una divisione per zero", () => {
    const risultato = confrontaTargetCommerciali({
      ...INPUT_BASE,
      targetBudgetMensile: 500,
      investimentoPeriodo: 750,
      numeroMesiPeriodo: 0,
    });
    expect(risultato.budgetMensile).toEqual({ atteso: 500, effettivo: 750 });
  });
});
