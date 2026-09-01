import type { ValutazioneSalute } from "@/lib/salute";
import type { MeseSenzaFunnel } from "@/lib/kpiQualita";
import type { GhlRiepilogoResponse } from "@/types/ghl";
import { formatEuro, formatMese } from "@/lib/format";

export type TonoAvviso = "attenzione" | "da-sistemare" | "da-sapere";
export type AvvisoOperativo = { id: string; tono: TonoAvviso; titolo: string; messaggio: string };

// "il peggio vince" applicato all'ORDINE di lettura, non solo a un giudizio aggregato — stesso
// idioma di ORDINE_SEVERITA in salute.ts/valutazioneCampagna.ts: chi ha più bisogno di attenzione
// va letto per primo.
const ORDINE_TONO: Record<TonoAvviso, number> = { attenzione: 0, "da-sistemare": 1, "da-sapere": 2 };

/**
 * Blocco 4 del redesign KPI — genera gli avvisi operativi automatici per il pannello visibile solo
 * a consulente/admin (gated su Boolean(clienteId) dal chiamante, mai sul link pubblico `code`).
 * Pura funzione di derivazione: nessun fetch, nessuno stato — tutti gli input sono già calcolati
 * dal chiamante (KpiSection.tsx) per il periodo/campagne correnti, quindi il pannello si ricalcola
 * da solo (useMemo) ogni volta che quei filtri cambiano, senza bisogno di logica dedicata qui.
 *
 * Deliberatamente NON riceve `adAccountCollegato`: quel caso ha già un proprio banner dedicato e
 * azionabile (form inline "+ Aggiungi ad account" in KpiSection.tsx, solo admin) — duplicarlo qui
 * come una riga di solo testo avrebbe tolto l'azione diretta senza aggiungere nulla.
 */
export function generaAvvisiOperativi(input: {
  valutazioneSalute: ValutazioneSalute;
  attivitaInRitardoCount: number;
  meseSenzaFunnel: MeseSenzaFunnel[];
  ghl: GhlRiepilogoResponse | null;
  campagneFrequenzaAlta: { nomeCampagna: string; frequenza: number }[];
}): AvvisoOperativo[] {
  const avvisi: AvvisoOperativo[] = [];
  const { valutazioneSalute: v } = input;

  if (v.stato === "interveni" && v.valoreAttuale !== null && v.targetUsato !== null && v.targetUsato > 0) {
    const percentualeSopra = Math.round((v.valoreAttuale / v.targetUsato - 1) * 100);
    const metrica = v.metricaUsata === "vendita" ? "CPA su vendita" : "Costo per lead";
    avvisi.push({
      id: "salute",
      tono: "attenzione",
      titolo: "Costo sopra target",
      messaggio: `${metrica} a ${formatEuro(v.valoreAttuale)}, il ${percentualeSopra}% sopra il target di ${formatEuro(v.targetUsato)}.`,
    });
  }

  if (input.attivitaInRitardoCount > 0) {
    avvisi.push({
      id: "attivita-ritardo",
      tono: "attenzione",
      titolo: "Attività in ritardo",
      messaggio:
        input.attivitaInRitardoCount === 1
          ? "1 attività aperta è in ritardo."
          : `${input.attivitaInRitardoCount} attività aperte sono in ritardo.`,
    });
  }

  if (input.campagneFrequenzaAlta.length > 0) {
    // Elenca le prime 3 per nome, riassume il resto — mai una riga lunghissima con decine di nomi.
    const nomi = input.campagneFrequenzaAlta.slice(0, 3).map((c) => `${c.nomeCampagna} (${c.frequenza.toFixed(2)})`);
    const restanti = input.campagneFrequenzaAlta.length - nomi.length;
    const suffisso = restanti > 0 ? ` e altre ${restanti}` : "";
    avvisi.push({
      id: "frequenza-alta",
      tono: "attenzione",
      titolo: "Frequenza alta",
      messaggio: `${nomi.join(", ")}${suffisso} — creatività da rinnovare.`,
    });
  }

  if (input.meseSenzaFunnel.length > 0) {
    const mesi = input.meseSenzaFunnel.map((m) => formatMese(m.mese)).join(", ");
    avvisi.push({
      id: "funnel-mancante",
      tono: "da-sistemare",
      titolo: "Funnel non compilato",
      messaggio: `Spesa pubblicitaria registrata ma nessun dato Funnel per ${mesi}.`,
    });
  }

  if (input.ghl && input.ghl.connesso && !input.ghl.calendariConfigurati) {
    avvisi.push({
      id: "ghl-calendari-non-configurati",
      tono: "da-sistemare",
      titolo: "Calendari GHL da collegare",
      messaggio: "La sede è connessa a GHL ma nessun calendario è stato scelto: appuntamenti ed effettuati restano dal Funnel finché non li colleghi.",
    });
  }

  if (input.ghl && input.ghl.connesso && input.ghl.calendariFalliti > 0) {
    avvisi.push({
      id: "ghl-calendari-falliti",
      tono: "da-sapere",
      titolo: "Calendari GHL non raggiungibili",
      messaggio:
        input.ghl.calendariFalliti === 1
          ? "1 calendario non era raggiungibile all'ultimo caricamento: il conteggio appuntamenti potrebbe essere incompleto."
          : `${input.ghl.calendariFalliti} calendari non erano raggiungibili all'ultimo caricamento: il conteggio appuntamenti potrebbe essere incompleto.`,
    });
  }

  return avvisi.sort((a, b) => ORDINE_TONO[a.tono] - ORDINE_TONO[b.tono]);
}
