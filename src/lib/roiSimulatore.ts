import type { ScenarioRoi } from "@/types/prospect";

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
 * Proietta uno scenario della Simulazione ROI — stessa formula già in uso nel resto dell'app
 * (costoPerLead/cpa/roas in src/lib/kpi.ts), ma in avanti invece che a consuntivo: dato un budget e
 * dei tassi di conversione attesi, quante vendite/quanto fatturato ci si può aspettare. Mai
 * inventata dal modello di estrazione — è una proiezione che il commerciale costruisce lui stesso,
 * vedi ReportCommercialeDataLoose.scenarioA/B.
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
