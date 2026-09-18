import type { RisultatoVenditoreRow, Venditore } from "@/types/kpi";

export type RisultatoVenditoreAggregato = { appuntamentiFissati: number; vendite: number; fatturato: number };

/**
 * Somma i risultati di ogni venditore nel periodo `da`/`a` (mesi YYYY-MM inclusivi) — stesso schema
 * "filtra e somma per chiave" già in uso in computeKpi (lib/kpi.ts), qui isolato in una funzione pura
 * perché la sorgente (RisultatiVenditori) è una tab a parte, non passa da computeKpi. Un venditore
 * senza righe nel periodo semplicemente non compare nella mappa (mai una entry a zero inventata):
 * il chiamante (PacingVenditoriChart.tsx) tratta "assente" come zero solo al momento di calcolare il
 * pacing, non qui.
 */
export function aggregaRisultatiVenditori(
  risultati: RisultatoVenditoreRow[],
  sedeId: string,
  da: string,
  a: string
): Map<string, RisultatoVenditoreAggregato> {
  const mappa = new Map<string, RisultatoVenditoreAggregato>();
  for (const row of risultati) {
    if (row.sedeId !== sedeId) continue;
    if (row.mese < da || row.mese > a) continue;
    const voce = mappa.get(row.venditoreId) ?? { appuntamentiFissati: 0, vendite: 0, fatturato: 0 };
    voce.appuntamentiFissati += row.appuntamentiFissati;
    voce.vendite += row.vendite;
    voce.fatturato += row.fatturato;
    mappa.set(row.venditoreId, voce);
  }
  return mappa;
}

/**
 * Quota di carico di ogni venditore ATTIVO, proporzionale alla capienza dichiarata — stesso
 * meccanismo del cruscotto di riferimento (quotaOf: cap/capTot). Somma delle quote sempre 1 quando
 * almeno un venditore ha capienza > 0; mappa vuota se non ci sono venditori attivi o la capienza
 * totale è 0 (mai una divisione per zero silenziosa: il chiamante vede semplicemente "nessuna
 * quota", non un target NaN).
 */
export function calcolaQuoteVenditori(venditori: Venditore[]): Map<string, number> {
  const attivi = venditori.filter((v) => v.attivo);
  const capienzaTotale = attivi.reduce((s, v) => s + v.capienzaAppuntamentiMensile, 0);
  const mappa = new Map<string, number>();
  if (capienzaTotale <= 0) return mappa;
  for (const v of attivi) {
    mappa.set(v.venditoreId, v.capienzaAppuntamentiMensile / capienzaTotale);
  }
  return mappa;
}
