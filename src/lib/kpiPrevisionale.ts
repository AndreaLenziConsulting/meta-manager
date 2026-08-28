import { divideOrNull } from "@/lib/kpi";
import type { ScenarioRoi } from "@/types/prospect";

export type InputScenarioReale = {
  investimentoTotalePeriodo: number;
  numeroMesiPeriodo: number;
  numeroLead: number;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  numeroVendite: number;
  fatturato: number;
};

/**
 * Arrotonda un rapporto (mai un conteggio intero) a `decimali` cifre — i campi di ScenarioRoi sono
 * un PUNTO DI PARTENZA per i campi editabili del simulatore, non un risultato di calcolo esatto: la
 * divisione fra due numeri reali produce quasi sempre una coda di decimali (es. 32,78958041958043)
 * che in un input numerico modificabile a mano è solo rumore, mai un dato utile in più. `null`
 * passa invariato.
 */
function arrotonda(valore: number | null, decimali: number): number | null {
  if (valore === null) return null;
  const fattore = 10 ** decimali;
  return Math.round(valore * fattore) / fattore;
}

/**
 * Deriva dai dati reali del periodo selezionato un punto di partenza plausibile per il
 * Simulatore ROI (src/lib/roiSimulatore.ts) — non calcola l'output della simulazione, produce
 * solo lo ScenarioRoi di input che il chiamante passerà a calcolaScenarioRoi.
 */
export function scenarioDaDatiReali(input: InputScenarioReale): ScenarioRoi {
  const tassoAppuntamentoRapporto = divideOrNull(input.appuntamentiFissati, input.numeroLead);
  const tassoChiusuraRapporto = divideOrNull(input.numeroVendite, input.appuntamentiEffettuati);

  return {
    nome: "Sede corrente",
    // Campi in euro: 2 decimali, come ogni importo mostrato altrove nell'app (formatEuro).
    budgetMensile: arrotonda(divideOrNull(input.investimentoTotalePeriodo, input.numeroMesiPeriodo), 2),
    cpl: arrotonda(divideOrNull(input.investimentoTotalePeriodo, input.numeroLead), 2),
    // tassoAppuntamento/tassoChiusura in ScenarioRoi sono percentuali 0-100 (vedi roiSimulatore.ts
    // che li divide per 100), qui il rapporto va quindi moltiplicato per 100 — poi arrotondato a
    // 1 decimale, coerente con formatPercentuale altrove nell'app.
    tassoAppuntamento: arrotonda(tassoAppuntamentoRapporto !== null ? tassoAppuntamentoRapporto * 100 : null, 1),
    tassoChiusura: arrotonda(tassoChiusuraRapporto !== null ? tassoChiusuraRapporto * 100 : null, 1),
    valoreMedioVendita: arrotonda(divideOrNull(input.fatturato, input.numeroVendite), 2),
  };
}
