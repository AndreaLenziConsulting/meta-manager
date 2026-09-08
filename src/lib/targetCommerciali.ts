export type ConfrontoTarget = { atteso: number; effettivo: number };

export type ConfrontoTargetCommerciali = {
  budgetMensile: ConfrontoTarget | null;
  leadSettimana: ConfrontoTarget | null;
  appuntamentiSettimana: ConfrontoTarget | null;
  fatturatoMensile: ConfrontoTarget | null;
};

/** Media di una serie che può avere buchi (mese senza dato Funnel) — ignora i null invece di
 * propagarli: un mese mancante non deve far sparire l'intero confronto, solo ridurre il campione. */
function mediaIgnorandoNulli(valori: (number | null)[]): number | null {
  const validi = valori.filter((v): v is number => v !== null);
  if (validi.length === 0) return null;
  return validi.reduce((a, b) => a + b, 0) / validi.length;
}

/**
 * Confronta i 4 target commerciali di sede (Fase 1 roadmap, "target concordati con i clienti") con
 * l'andamento reale nel periodo selezionato — pura funzione di calcolo: la soglia "fuori target"
 * resta in avvisiOperativi.ts (stesso schema di campagneFrequenzaAlta/inserzioniOutlier, dati grezzi
 * qui, soglia là). Ogni campo è `null` se manca il target per quella sede (nessun confronto
 * possibile) — mai un falso "in target" per assenza di dato.
 *
 * budget/fatturato sono target MENSILI: l'effettivo è il totale del periodo diviso per il numero di
 * mesi coperti (`contaMesiPeriodo`, già in uso in KpiSection.tsx per il confronto col periodo
 * precedente) — un periodo di 2 mesi non deve far sembrare doppio un budget mensile concordato.
 * lead/appuntamenti sono target SETTIMANALI: l'effettivo è la media della serie settimanale già
 * GHL-overlay-aware (`trendSettimanaleConOverlay`, la stessa fonte del grafico Costo per
 * Risultato) — non un nuovo calcolo, solo una media su dati già corretti.
 *
 * Deliberatamente NESSUN campo per "utile" (per vendita/mensile): nessun dato di profitto reale
 * tracciato in app oggi, richiesta esplicita dell'utente di ignorarlo per questo giro.
 */
export function confrontaTargetCommerciali(input: {
  targetBudgetMensile: number | null;
  targetLeadSettimana: number | null;
  targetAppuntamentiSettimana: number | null;
  targetFatturatoMensile: number | null;
  investimentoPeriodo: number;
  fatturatoPeriodo: number;
  numeroMesiPeriodo: number;
  serieSettimanale: { numeroLead: number; appuntamentiFissati: number | null }[];
}): ConfrontoTargetCommerciali {
  const mesi = input.numeroMesiPeriodo > 0 ? input.numeroMesiPeriodo : 1;
  const leadEffettivo = mediaIgnorandoNulli(input.serieSettimanale.map((s) => s.numeroLead));
  const appuntamentiEffettivo = mediaIgnorandoNulli(input.serieSettimanale.map((s) => s.appuntamentiFissati));

  return {
    budgetMensile:
      input.targetBudgetMensile !== null
        ? { atteso: input.targetBudgetMensile, effettivo: input.investimentoPeriodo / mesi }
        : null,
    leadSettimana:
      input.targetLeadSettimana !== null && leadEffettivo !== null
        ? { atteso: input.targetLeadSettimana, effettivo: leadEffettivo }
        : null,
    appuntamentiSettimana:
      input.targetAppuntamentiSettimana !== null && appuntamentiEffettivo !== null
        ? { atteso: input.targetAppuntamentiSettimana, effettivo: appuntamentiEffettivo }
        : null,
    fatturatoMensile:
      input.targetFatturatoMensile !== null
        ? { atteso: input.targetFatturatoMensile, effettivo: input.fatturatoPeriodo / mesi }
        : null,
  };
}
