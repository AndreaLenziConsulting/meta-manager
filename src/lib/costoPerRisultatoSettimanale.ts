import { divideOrNull } from "@/lib/kpi";

export type PuntoCostoPerRisultato = {
  settimana: string;
  spesa: number;
  costoPerAppuntamento: number | null;
  // CAC (Customer Acquisition Cost) = investimento/vendite di quella settimana — chiamato
  // "costoPerVendita" qui per coerenza col resto del dominio (costoPerLead, costoPerClic,
  // ecc. — tutti "costoPer<risultato>"), "CAC" resta il nome mostrato in etichetta/legenda.
  costoPerVendita: number | null;
};

/** Come divideOrNull ma accetta un denominatore null (mese senza dato Funnel per quella settimana,
 * vedi trendSettimanale in kpi.ts) — null propaga a null, non tenta 0 come denominatore. */
function divideOrNullNullable(numeratore: number, denominatore: number | null): number | null {
  if (denominatore === null) return null;
  return divideOrNull(numeratore, denominatore);
}

/**
 * Blocco 6b del redesign KPI — "Costo per Risultato": Spesa (asse sinistro) + Costo per
 * Appuntamento e CAC (asse destro, €/unità) per settimana. Unico grafico dell'app con doppio asse
 * — scelta consapevole dell'utente nonostante l'anti-pattern (vedi skill dataviz e il commento in
 * TrendChart.tsx, che resta l'unico posto dove "mai doppio asse" vale senza eccezioni): qui le due
 * scale (€ totali vs €/unità) sono volutamente diverse, il punto è leggere l'andamento di ciascuna
 * linea nel tempo, non confrontarne le altezze fra loro.
 *
 * `serie` è già la vista overlay-GHL-aware costruita dal chiamante per appuntamentiFissati/
 * numeroVendite (stessa fonte di trendSettimanaleConOverlay già in uso da TrendChart.tsx) — questa
 * funzione resta pura, non sa nulla di GHL/Funnel, solo aritmetica.
 */
export function calcolaCostoPerRisultatoSettimanale(
  serie: { settimana: string; investimento: number; appuntamentiFissati: number | null; numeroVendite: number | null }[]
): PuntoCostoPerRisultato[] {
  return serie.map((s) => ({
    settimana: s.settimana,
    spesa: s.investimento,
    costoPerAppuntamento: divideOrNullNullable(s.investimento, s.appuntamentiFissati),
    costoPerVendita: divideOrNullNullable(s.investimento, s.numeroVendite),
  }));
}
