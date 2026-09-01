import { divideOrNull } from "@/lib/kpi";

export type StadioFunnelConversione = {
  stadio: "lead" | "appuntamentiFissati" | "appuntamentiEffettuati" | "vendite";
  etichetta: string;
  conteggio: number;
  // Percentuale sul PRIMO stadio (Lead) — "quanti lead sono arrivati fin qui". Null solo se il
  // periodo non ha nessun lead (divisione per zero), mai un falso 0%.
  percentualeSuLead: number | null;
  // Percentuale di conversione allo stadio SUCCESSIVO — null per l'ultimo stadio (Vendite, non ha
  // un "prossimo") o se lo stadio corrente è zero (nessuna base su cui calcolare una conversione).
  percentualeConversioneAlProssimo: number | null;
};

const ETICHETTE: Record<StadioFunnelConversione["stadio"], string> = {
  lead: "Lead generati",
  appuntamentiFissati: "Appuntamenti fissati",
  appuntamentiEffettuati: "Appuntamenti effettuati",
  vendite: "Vendite",
};

/**
 * Blocco 6a del redesign KPI — funnel di conversione a 4 stadi, un vero imbuto (bande impilate a
 * larghezza decrescente), non un grafico a barre. Parte da Lead (Meta Ads, mai overlay GHL — GHL
 * non genera lead, li riceve già generati), a differenza del vecchio funnelStadi.ts (eliminato in
 * questo redesign) che partiva da Richieste (Funnel): quello contava un sottoinsieme dei lead già
 * qualificato a mano dal team, questo mostra l'imbuto pubblicitario intero da dove arriva il primo
 * contatto. `input` è già la vista overlay-GHL-aware costruita dal chiamante (stessa fonte delle
 * tessere di sintesi) per fissati/effettuati/vendite — solo numeroLead resta sempre Meta puro.
 */
export function costruisciFunnelConversione(input: {
  numeroLead: number;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  numeroVendite: number;
}): StadioFunnelConversione[] {
  const ordine: { stadio: StadioFunnelConversione["stadio"]; conteggio: number }[] = [
    { stadio: "lead", conteggio: input.numeroLead },
    { stadio: "appuntamentiFissati", conteggio: input.appuntamentiFissati },
    { stadio: "appuntamentiEffettuati", conteggio: input.appuntamentiEffettuati },
    { stadio: "vendite", conteggio: input.numeroVendite },
  ];

  return ordine.map((s, i) => {
    const prossimo = ordine[i + 1];
    return {
      stadio: s.stadio,
      etichetta: ETICHETTE[s.stadio],
      conteggio: s.conteggio,
      percentualeSuLead: divideOrNull(s.conteggio, input.numeroLead),
      percentualeConversioneAlProssimo: prossimo ? divideOrNull(prossimo.conteggio, s.conteggio) : null,
    };
  });
}
