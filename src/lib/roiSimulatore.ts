import { MESI_BREVI } from "@/lib/format";
import type { CalcolatoreBudgetInput, ScenarioRoi } from "@/types/prospect";

function divideOrNull(numeratore: number, denominatore: number): number | null {
  if (!denominatore) return null;
  return numeratore / denominatore;
}

export type ScenarioRoiOutput = {
  numeroLead: number | null;
  numeroAppuntamenti: number | null;
  numeroVendite: number | null;
  cpa: number | null;
  fatturatoAtteso: number | null;
  roas: number | null;
};

/**
 * Proietta uno scenario in avanti — stessa formula già in uso nel resto dell'app
 * (costoPerLead/cpa/roas in src/lib/kpi.ts): dato un budget e dei tassi di conversione attesi,
 * quante vendite/quanto fatturato ci si può aspettare. Usata oggi solo da
 * PerformancePrevisionale.tsx (tab KPI di un cliente già attivo, seed pre-popolato dai dati reali
 * — vedi scenarioDaDatiReali in kpiPrevisionale.ts); il Report Commerciale usa invece il calcolo
 * "al contrario" più sotto (calcolaCalcolatoreBudget).
 */
export function calcolaScenarioRoi(input: ScenarioRoi): ScenarioRoiOutput {
  const budget = input.budgetMensile ?? 0;
  const cpl = input.cpl ?? 0;
  const tassoAppuntamento = (input.tassoAppuntamento ?? 0) / 100;
  const tassoChiusura = (input.tassoChiusura ?? 0) / 100;
  const valoreMedioVendita = input.valoreMedioVendita ?? 0;

  const numeroLead = divideOrNull(budget, cpl);
  const numeroAppuntamenti = numeroLead !== null ? numeroLead * tassoAppuntamento : null;
  const numeroVendite = numeroAppuntamenti !== null ? numeroAppuntamenti * tassoChiusura : null;
  const fatturatoAtteso = numeroVendite !== null ? numeroVendite * valoreMedioVendita : null;
  const cpa = numeroVendite !== null ? divideOrNull(budget, numeroVendite) : null;
  const roas = fatturatoAtteso !== null ? divideOrNull(fatturatoAtteso, budget) : null;

  return { numeroLead, numeroAppuntamenti, numeroVendite, cpa, fatturatoAtteso, roas };
}

export type CalcolatoreBudgetOutput = {
  numeroVendite: number | null;
  numeroAppuntamenti: number | null;
  appuntamentiSettimana: number | null;
  numeroLead: number | null;
  budgetMensile: number | null;
  margineMensile: number | null;
  costoPerAppuntamento: number | null;
  roas: number | null;
};

// Settimane medie in un mese (365.25/7/12) — stesso valore già in uso per le medie settimanali del
// tab KPI (vedi kpiSettimanale.ts), riusato qui per "appuntamenti attesi a settimana" a partire da
// un dato mensile. Esportata: ConvertiProspectModal.tsx la riusa per derivare "lead a settimana"
// (che calcolaCalcolatoreBudget non calcola direttamente, solo numeroLead mensile) quando
// precompila i target della Sede alla conversione — vedi POST /api/prospect/converti.
export const SETTIMANE_PER_MESE = 4.33;

/**
 * Calcolatore Budget del Report Commerciale — proiezione "al contrario" rispetto a
 * calcolaScenarioRoi sopra: qui il punto di partenza è un fatturato mensile OBIETTIVO (non un
 * budget), e si risale a quante vendite/appuntamenti/lead servono per raggiungerlo e quale budget
 * media serve a sua volta per generare quei lead. Stessa convenzione di null-guard di
 * calcolaScenarioRoi/divideOrNull: un denominatore a zero o nullo (ticket medio, tasso di
 * conversione, CPL) fa risalire null a tutto ciò che dipende da quella divisione, mai
 * Infinity/NaN. Mai estratto dal modello — è una proiezione che il commerciale costruisce lui
 * stesso, vedi ReportCommercialeDataLoose.calcolatoreBudget.
 */
export function calcolaCalcolatoreBudget(input: CalcolatoreBudgetInput): CalcolatoreBudgetOutput {
  const fatturatoMensile = input.fatturatoMensile ?? 0;
  const ticketMedio = input.ticketMedio ?? 0;
  const margine = (input.margine ?? 0) / 100;
  const cpl = input.cpl ?? 0;
  const tassoAppuntamento = (input.tassoAppuntamento ?? 0) / 100;
  const tassoChiusura = (input.tassoChiusura ?? 0) / 100;

  const numeroVendite = divideOrNull(fatturatoMensile, ticketMedio);
  const numeroAppuntamenti = numeroVendite !== null ? divideOrNull(numeroVendite, tassoChiusura) : null;
  const appuntamentiSettimana = numeroAppuntamenti !== null ? numeroAppuntamenti / SETTIMANE_PER_MESE : null;
  const numeroLead = numeroAppuntamenti !== null ? divideOrNull(numeroAppuntamenti, tassoAppuntamento) : null;
  const budgetMensile = numeroLead !== null ? numeroLead * cpl : null;
  const margineMensile = input.fatturatoMensile !== null ? fatturatoMensile * margine : null;
  const costoPerAppuntamento = budgetMensile !== null && numeroAppuntamenti !== null ? divideOrNull(budgetMensile, numeroAppuntamenti) : null;
  const roas = budgetMensile !== null ? divideOrNull(fatturatoMensile, budgetMensile) : null;

  return { numeroVendite, numeroAppuntamenti, appuntamentiSettimana, numeroLead, budgetMensile, margineMensile, costoPerAppuntamento, roas };
}

export type MeseCalcolatoreBudget = {
  mese: string; // "Gen".."Dic", vedi MESI_BREVI
  appuntamenti: number;
  appuntamentiSettimana: number;
  vendite: number;
  budget: number;
  margine: number;
  fatturatoProgressivo: number;
};

// Curva stagionale di riferimento per un cliente cucine su misura (alta in primavera/autunno,
// bassa in piena estate/gennaio) — stessa forma già usata come mockup dal collega, indicativa: non
// è una stagionalità osservata sui dati reali del cliente (per quella vedi confrontoPeriodo.ts sui
// KPI storici), solo una curva di default ragionevole per pianificare un budget annuo non ancora
// partito. L'utente la attenua/amplifica con `variazioneStagionale` (0 = piatta, 50 = piena).
const CURVA_STAGIONALE_BASE = [0.85, 0.9, 1.05, 1.1, 1.1, 1.0, 0.9, 0.75, 1.05, 1.15, 1.05, 0.8] as const;

/**
 * Piano annuale del Calcolatore Budget — 12 righe mensili derivate dallo stesso scenario base di
 * calcolaCalcolatoreBudget, modulate dalla curva stagionale sopra e dall'ampiezza scelta
 * dall'utente. Il fatturato progressivo somma il fatturato mensile OBIETTIVO costante (non
 * stagionato: l'obiettivo resta un ritmo medio, la stagionalità sposta solo quando servono più o
 * meno lead/appuntamenti per tenerlo). Ritorna [] se lo scenario base non è calcolabile (fatturato,
 * ticket medio o tassi mancanti) — il chiamante mostra un messaggio invece di 12 righe a "—".
 */
export function calcolaPianoAnnualeBudget(input: CalcolatoreBudgetInput): MeseCalcolatoreBudget[] {
  const base = calcolaCalcolatoreBudget(input);
  if (base.numeroAppuntamenti === null || base.numeroVendite === null || base.budgetMensile === null || base.margineMensile === null) {
    return [];
  }
  const fatturatoMensile = input.fatturatoMensile ?? 0;
  const ampiezza = (input.variazioneStagionale ?? 0) / 100;

  return CURVA_STAGIONALE_BASE.map((coefficienteBase, i) => {
    const coefficiente = 1 + ampiezza * (coefficienteBase - 1);
    const appuntamenti = base.numeroAppuntamenti! * coefficiente;
    return {
      mese: MESI_BREVI[i],
      appuntamenti: Math.ceil(appuntamenti),
      appuntamentiSettimana: appuntamenti / SETTIMANE_PER_MESE,
      vendite: Math.ceil(base.numeroVendite! * coefficiente),
      budget: Math.round(base.budgetMensile! * coefficiente),
      margine: Math.round(base.margineMensile! * coefficiente),
      fatturatoProgressivo: fatturatoMensile * (i + 1),
    };
  });
}
