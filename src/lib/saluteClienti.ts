import { campagnePredefinite } from "@/lib/campagneAlc";
import type { SaluteClienteItem, SaluteSedeValutazione } from "@/lib/dashboardAdmin";
import { computeSpesaLeadPeriodo } from "@/lib/kpi";
import { attivitaInRitardo, oggiIso, raggruppaAttivitaPerCliente } from "@/lib/roadmap";
import { aggregaValutazioniSedi, calcolaSalute } from "@/lib/salute";
import { andamentoSentiment, raggruppaMeetingPerCliente } from "@/lib/sentimentCliente";
import type { AttivitaClienteRow, Campagna, Cliente, MetaDailyRow, Sede } from "@/types/kpi";
import type { MeetingClienteRow } from "@/types/meeting";

/** Su quanti giorni la pagina Clienti (e il riepilogo per l'amministrazione) giudica il costo per lead. */
export const GIORNI_FINESTRA_SALUTE = 7;

/** Primo e ultimo giorno della finestra che finisce `oggi`. */
export function finestraSalute(oggi: string = oggiIso()): { da: string; a: string } {
  const inizio = new Date(`${oggi}T00:00:00Z`);
  inizio.setUTCDate(inizio.getUTCDate() - (GIORNI_FINESTRA_SALUTE - 1));
  return { da: inizio.toISOString().slice(0, 10), a: oggi };
}

/**
 * I segnali di ogni cliente che la pagina Clienti mostra nelle sue card: salute delle ads (costo per
 * lead contro il target, una valutazione per sede e "il peggio vince" per il cliente), attività in
 * ritardo, clima degli incontri. Funzione pura.
 *
 * Stava dentro la pagina (dashboard/page.tsx); dal 09/10/2026 la usa anche il riepilogo via email per
 * l'amministrazione (src/lib/riepilogoAdmin.ts), che deve dire le stesse identiche cose della pagina:
 * un solo calcolo, due lettori.
 */
export function costruisciSaluteClienti(input: {
  /** I clienti da valutare (già filtrati: quelli che chi guarda può vedere). */
  clienti: Cliente[];
  sedi: Sede[];
  campagne: Campagna[];
  metaDaily: MetaDailyRow[];
  attivita: AttivitaClienteRow[];
  meeting: MeetingClienteRow[];
  da: string;
  a: string;
  oggi?: string;
}): SaluteClienteItem[] {
  const { clienti, sedi, campagne, metaDaily, attivita, meeting, da, a, oggi = oggiIso() } = input;
  const attivitaPerCliente = raggruppaAttivitaPerCliente(attivita);
  // Solo i meeting con un sentiment davvero compilato: un meeting recente a volte non è ancora
  // stato revisionato (sentiment vuoto) e non deve interrompere una serie di segnali precedenti
  // ancora validi — vedi caso reale osservato: ultimo meeting vuoto, penultimo "Negativo".
  const meetingConSentimentPerCliente = raggruppaMeetingPerCliente(meeting.filter((m) => m.sentiment.trim() !== ""));

  return clienti.map((cliente) => {
    const sediValutate: SaluteSedeValutazione[] = sedi
      .filter((s) => s.clienteId === cliente.clienteId && s.attivo)
      .map((sede) => {
        // Stesso filtro predefinito della pagina cliente (06/10/2026, vedi src/lib/campagneAlc.ts): se
        // la sede ha campagne con ALC nel nome, spesa e lead della scheda contano solo quelle.
        const predefinite = campagnePredefinite(sede, campagne);
        const { investimento, numeroLead, costoPerLead } = computeSpesaLeadPeriodo(
          cliente.clienteId,
          sede.sedeId,
          da,
          a,
          metaDaily,
          predefinite ? campagne.filter((c) => predefinite.has(c.campaignId)) : campagne
        );
        const valutazione = calcolaSalute({ investimento, numeroVendite: 0, cpa: null, costoPerLead }, sede.targetCpa, sede.targetCpl);
        return { sede, investimento, numeroLead, valutazione };
      });
    // "Il peggio vince" tra le sedi decide lo stato della card — vedi aggregaValutazioniSedi.
    // Un cliente senza nessuna sede attiva (caso limite, es. subito dopo la creazione) non ha
    // nulla da aggregare: resta "no-target" come farebbe calcolaSalute senza target impostato.
    const valutazione =
      sediValutate.length > 0
        ? aggregaValutazioniSedi(sediValutate.map((s) => s.valutazione))
        : { stato: "no-target" as const, metricaUsata: null, valoreAttuale: null, targetUsato: null };
    return {
      cliente,
      sedi: sediValutate,
      valutazione,
      investimento: sediValutate.reduce((somma, s) => somma + s.investimento, 0),
      numeroLead: sediValutate.reduce((somma, s) => somma + s.numeroLead, 0),
      attivitaInRitardo: attivitaInRitardo(attivitaPerCliente.get(cliente.clienteId) ?? [], oggi),
      sentimentCritico: andamentoSentiment(meetingConSentimentPerCliente.get(cliente.clienteId) ?? []).aRischio,
    };
  });
}
