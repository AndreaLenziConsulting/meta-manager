import { divideOrNull } from "@/lib/kpi";
import type { KpiGroup, KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

export type CampoConFonte<T> = { valore: T; fonte: "ghl" | "funnel" };

export type KpiConOverlayGhl = {
  fatturato: CampoConFonte<number>;
  numeroVendite: CampoConFonte<number>;
  roas: CampoConFonte<number | null>;
  cpa: CampoConFonte<number | null>;
  appuntamentiFissati: CampoConFonte<number>;
  appuntamentiEffettuati: CampoConFonte<number>;
  percentualeEffettuatiSuFissati: CampoConFonte<number | null>;
  costoPerAppuntamentoEffettuato: CampoConFonte<number | null>;
  tassoDiChiusura: CampoConFonte<number | null>;
  // Solo gli appuntamenti possono essere parziali: fetchAppuntamenti (ghl.ts) è per-calendario con
  // retry/fallback, fetchOpportunita è una singola chiamata a livello di location senza dipendenza
  // dai calendari — vedi calendariFalliti in GhlRiepilogoResponse.
  parziale: boolean;
};

type TotaleFunnel = Pick<
  KpiGroup,
  | "investimento"
  | "fatturato"
  | "numeroVendite"
  | "roas"
  | "cpa"
  | "appuntamentiFissati"
  | "appuntamentiEffettuati"
  | "percentualeEffettuatiSuFissati"
  | "costoPerAppuntamentoEffettuato"
  | "tassoDiChiusura"
>;

function soloFunnel(t: TotaleFunnel): KpiConOverlayGhl {
  return {
    fatturato: { valore: t.fatturato, fonte: "funnel" },
    numeroVendite: { valore: t.numeroVendite, fonte: "funnel" },
    roas: { valore: t.roas, fonte: "funnel" },
    cpa: { valore: t.cpa, fonte: "funnel" },
    appuntamentiFissati: { valore: t.appuntamentiFissati, fonte: "funnel" },
    appuntamentiEffettuati: { valore: t.appuntamentiEffettuati, fonte: "funnel" },
    percentualeEffettuatiSuFissati: { valore: t.percentualeEffettuatiSuFissati, fonte: "funnel" },
    costoPerAppuntamentoEffettuato: { valore: t.costoPerAppuntamentoEffettuato, fonte: "funnel" },
    tassoDiChiusura: { valore: t.tassoDiChiusura, fonte: "funnel" },
    parziale: false,
  };
}

/**
 * Per un cliente con connessione GHL attiva, sostituisce le tessere KPI lette oggi dal Funnel
 * (inserito a mano) con i numeri letti in diretta da GHL — su richiesta esplicita dell'utente, che
 * ha confermato di voler sostituire le tessere esistenti invece di tenerle in un pannello a parte
 * (rimosso, vedi GhlPanel.tsx nella cronologia git). Riusato anche per la riga "Totale" della
 * tabella Dettaglio (KpiTable.tsx) — le righe per tipo campagna restano invece 100% Funnel, GHL non
 * è attribuibile per tipo di campagna.
 *
 * "Appuntamenti effettuati" (e tutto ciò che ne deriva: % effettuati su fissati, Costo/App.
 * effettuato, Tasso di chiusura) segue uno STANDARD OPERATIVO deciso dall'utente il 27/08/2026, non
 * un vero segnale di presenza da GHL: GHL in questo dominio ha solo stato confirmed/cancelled, mai
 * showed/noshow (vedi commento su riepilogoAppuntamenti in lib/ghl.ts) — un appuntamento con
 * incontro (startTime) già passato e MAI annullato attivamente conta come effettuato. Il team
 * commerciale deve quindi annullare attivamente chi non si presenta, altrimenti resta conteggiato
 * come avvenuto.
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
    // vero, lo stesso motivo per cui GhlPanel.tsx (rimosso) mostrava un avviso in quel caso. Si
    // resta sul Funnel per tutto ciò che dipende dai calendari finché l'admin non li sceglie.
    appuntamentiFissati: { valore: totaleFunnel.appuntamentiFissati, fonte: "funnel" },
    appuntamentiEffettuati: { valore: totaleFunnel.appuntamentiEffettuati, fonte: "funnel" },
    percentualeEffettuatiSuFissati: { valore: totaleFunnel.percentualeEffettuatiSuFissati, fonte: "funnel" },
    costoPerAppuntamentoEffettuato: { valore: totaleFunnel.costoPerAppuntamentoEffettuato, fonte: "funnel" },
    tassoDiChiusura: { valore: totaleFunnel.tassoDiChiusura, fonte: "funnel" },
    parziale: false,
  };

  if (ghl.calendariConfigurati) {
    const fissati = ghl.appuntamenti.totali;
    const effettuati = ghl.appuntamenti.effettuati;
    risultato.appuntamentiFissati = { valore: fissati, fonte: "ghl" };
    risultato.appuntamentiEffettuati = { valore: effettuati, fonte: "ghl" };
    risultato.percentualeEffettuatiSuFissati = { valore: divideOrNull(effettuati, fissati), fonte: "ghl" };
    // investimento resta sempre da Meta Ads (GHL non ha questo concetto) — solo il denominatore
    // (effettuati) cambia fonte, stesso schema di percentualeEffettuatiSuFissati sopra.
    risultato.costoPerAppuntamentoEffettuato = { valore: divideOrNull(totaleFunnel.investimento, effettuati), fonte: "ghl" };
    // Numeratore (vendite) e denominatore (effettuati) sono entrambi GHL qui — a differenza del
    // caso senza calendari configurati, dove mescolare un numeratore GHL con un denominatore
    // Funnel produrrebbe un tasso senza senso (per questo lì resta 100% Funnel, mai un mix).
    risultato.tassoDiChiusura = { valore: divideOrNull(numeroVendite, effettuati), fonte: "ghl" };
    risultato.parziale = ghl.calendariFalliti > 0;
  }

  return risultato;
}

/**
 * Sovrappone il fatturato SETTIMANALE GHL al trend del grafico "Investimento vs Fatturato"
 * (TrendChart.tsx) — join diretto sulla chiave `settimana` (stessa griglia lunedì-domenica di
 * trendSettimanale, vedi kpi.ts/ghl.ts), non un valore mensile ripetuto: ogni settimana ha il
 * proprio fatturato reale. Se GHL non ha nessuna opportunità vinta in quella settimana il valore
 * diventa 0, non il Funnel: una volta connesso, l'intera linea segue una sola fonte, mai un
 * patchwork settimana per settimana. Stesse condizioni di sospensione di applicaOverlayGhl (filtro
 * campagne attivo, non connesso) — il fatturato non dipende dai calendari, quindi nessun controllo
 * su calendariConfigurati qui.
 */
export function applicaOverlayGhlTrend(
  trendSettimanale: KpiResponse["trendSettimanale"],
  ghl: GhlRiepilogoResponse | null,
  opzioni: { filtroCampagneAttivo: boolean } = { filtroCampagneAttivo: false }
): KpiResponse["trendSettimanale"] {
  if (opzioni.filtroCampagneAttivo || !ghl || !ghl.connesso) {
    return trendSettimanale;
  }
  const fatturatoPerSettimana = new Map(ghl.fatturatoPerSettimana.map((s) => [s.settimana, s.fatturato]));
  return trendSettimanale.map((s) => ({ ...s, fatturato: fatturatoPerSettimana.get(s.settimana) ?? 0 }));
}
