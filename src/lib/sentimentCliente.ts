import type { MeetingClienteRow } from "@/types/meeting";

export type StatoSentiment = "positivo" | "neutro" | "negativo" | "sconosciuto";

/**
 * `sentiment` è testo libero estratto dall'AI da ogni meeting (src/lib/estrazione.ts) — il prompt
 * chiede di aprirlo con "positivo"/"neutro"/"negativo" seguito da una breve giustificazione nella
 * stessa stringa (es. "Negativo — il cliente si aspettava risultati migliori"), ma non è un enum
 * validato: questa è la fonte unica di classificazione, letta da tutto il resto del file.
 * "sconosciuto" in assenza di testo o se non inizia esplicitamente con uno dei tre — mai indovinato
 * da frasi ambigue nel mezzo del testo (es. "il budget è negativo quest'anno" non è il sentiment).
 */
export function classificaSentiment(sentiment: string): StatoSentiment {
  const testo = sentiment.trim().toLowerCase();
  if (/^positivo\b/.test(testo)) return "positivo";
  if (/^neutro\b/.test(testo)) return "neutro";
  if (/^negativo\b/.test(testo)) return "negativo";
  return "sconosciuto";
}

/** true solo per "negativo" — comodo dove serve solo il caso critico, non l'intera classificazione. */
export function sentimentCritico(sentiment: string): boolean {
  return classificaSentiment(sentiment) === "negativo";
}

/** Raggruppa i meeting di più clienti (come li restituisce getMeetingCliente()) per clienteId —
 * stesso schema di raggruppaAttivitaPerCliente in roadmap.ts. */
export function raggruppaMeetingPerCliente(meetings: MeetingClienteRow[]): Map<string, MeetingClienteRow[]> {
  const mappa = new Map<string, MeetingClienteRow[]>();
  for (const m of meetings) {
    const lista = mappa.get(m.clienteId) ?? [];
    lista.push(m);
    mappa.set(m.clienteId, lista);
  }
  return mappa;
}

export type PuntoSentiment = { meetingId: string; data: string; titolo: string; stato: StatoSentiment };

export type AndamentoSentiment = {
  /** In ordine cronologico, più vecchio prima — l'ordine giusto per un display "andamento nel
   * tempo" (Fase 1 roadmap). Il chiamante dovrebbe già escludere i meeting con sentiment vuoto
   * (non ancora revisionati) — vedi il commento nel chiamante in dashboard/page.tsx sul perché. */
  serie: PuntoSentiment[];
  /**
   * "Cliente a rischio", pensato per intercettare per tempo un peggioramento reale — non un singolo
   * giudizio isolato che potrebbe essere rumore. Regola: gli ultimi 2 meeting (se ce ne sono almeno
   * 2) sono ENTRAMBI negativi; con un solo meeting in tutto lo storico, quello resta l'unico segnale
   * disponibile e basta da solo (stesso comportamento di prima di questa funzione, per un cliente
   * appena avviato con una sola call fatta).
   */
  aRischio: boolean;
};

export function andamentoSentiment(meetings: MeetingClienteRow[]): AndamentoSentiment {
  const serie = [...meetings]
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .map((m) => ({ meetingId: m.meetingId, data: m.data, titolo: m.titolo, stato: classificaSentiment(m.sentiment) }));

  const ultimi = serie.slice(-2);
  const aRischio =
    ultimi.length >= 2 ? ultimi.every((p) => p.stato === "negativo") : ultimi.length === 1 && ultimi[0].stato === "negativo";

  return { serie, aRischio };
}
