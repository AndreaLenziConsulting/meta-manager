import { divideOrNull } from "@/lib/kpi";
import type { KpiGroup } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

export type CampoConFonte<T> = { valore: T; fonte: "ghl" | "funnel" };

export type KpiConOverlayGhl = {
  fatturato: CampoConFonte<number>;
  numeroVendite: CampoConFonte<number>;
  roas: CampoConFonte<number | null>;
  cpa: CampoConFonte<number | null>;
  appuntamentiFissati: CampoConFonte<number>;
  // Solo gli appuntamenti possono essere parziali: fetchAppuntamenti (ghl.ts) è per-calendario con
  // retry/fallback, fetchOpportunita è una singola chiamata a livello di location senza dipendenza
  // dai calendari — vedi calendariFalliti in GhlRiepilogoResponse.
  parziale: boolean;
};

type TotaleFunnel = Pick<KpiGroup, "investimento" | "fatturato" | "numeroVendite" | "roas" | "cpa" | "appuntamentiFissati">;

function soloFunnel(t: TotaleFunnel): KpiConOverlayGhl {
  return {
    fatturato: { valore: t.fatturato, fonte: "funnel" },
    numeroVendite: { valore: t.numeroVendite, fonte: "funnel" },
    roas: { valore: t.roas, fonte: "funnel" },
    cpa: { valore: t.cpa, fonte: "funnel" },
    appuntamentiFissati: { valore: t.appuntamentiFissati, fonte: "funnel" },
    parziale: false,
  };
}

/**
 * Per un cliente con connessione GHL attiva, sostituisce Fatturato/Vendite/ROAS/CPA/Appuntamenti
 * fissati (letti oggi dal Funnel, inserito a mano) con i numeri letti in diretta da GHL — su
 * richiesta esplicita dell'utente, che ha confermato di voler sostituire le tessere esistenti
 * invece di tenerle in un pannello a parte (rimosso, vedi GhlPanel.tsx nella cronologia git).
 *
 * Deliberatamente NON tocca Appuntamenti effettuati / % effettuati su fissati / Tasso di chiusura:
 * GHL in questo dominio ha solo stato confirmed/cancelled, mai showed/noshow (vedi commento su
 * riepilogoAppuntamenti in lib/ghl.ts) — "confermato" non equivale a "si è presentato", quindi
 * etichettare un numero GHL come "effettuato" direbbe una cosa che GHL non sa. Il tasso di
 * chiusura mescolerebbe un numeratore GHL con un denominatore Funnel nella stessa percentuale,
 * ancora più fuorviante che lasciare entrambi su un'unica fonte.
 *
 * Con un filtro campagne attivo l'overlay si sospende del tutto: GHL non sa a quale tipo di
 * campagna appartiene un'opportunità/appuntamento, quindi un investimento filtrato affiancato a un
 * fatturato non filtrato produrrebbe ROAS/CPA senza senso.
 */
export function applicaOverlayGhl(
  totaleFunnel: TotaleFunnel,
  ghl: GhlRiepilogoResponse | null,
  opzioni: { filtroCampagneAttivo: boolean } = { filtroCampagneAttivo: false }
): KpiConOverlayGhl {
  if (opzioni.filtroCampagneAttivo || !ghl || !ghl.connesso) {
    return soloFunnel(totaleFunnel);
  }

  const fatturato = ghl.opportunita.fatturato;
  const numeroVendite = ghl.opportunita.vendite;
  const risultato: KpiConOverlayGhl = {
    fatturato: { valore: fatturato, fonte: "ghl" },
    numeroVendite: { valore: numeroVendite, fonte: "ghl" },
    roas: { valore: divideOrNull(fatturato, totaleFunnel.investimento), fonte: "ghl" },
    cpa: { valore: divideOrNull(totaleFunnel.investimento, numeroVendite), fonte: "ghl" },
    // Senza calendari configurati l'API GHL restituisce comunque 0 appuntamenti — non un dato
    // vero, lo stesso motivo per cui GhlPanel.tsx mostrava un avviso in quel caso. Qui si resta
    // sul Funnel finché l'admin non sceglie i calendari.
    appuntamentiFissati: { valore: totaleFunnel.appuntamentiFissati, fonte: "funnel" },
    parziale: false,
  };

  if (ghl.calendariConfigurati) {
    risultato.appuntamentiFissati = { valore: ghl.appuntamenti.totali, fonte: "ghl" };
    risultato.parziale = ghl.calendariFalliti > 0;
  }

  return risultato;
}
