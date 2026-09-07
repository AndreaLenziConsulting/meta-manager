import type { MeetingClienteRow } from "@/types/meeting";

/**
 * `sentiment` è testo libero estratto dall'AI da ogni meeting (src/lib/estrazione.ts) — il prompt
 * chiede di aprirlo con "positivo"/"neutro"/"negativo" seguito da una breve giustificazione nella
 * stessa stringa (es. "Negativo — il cliente si aspettava risultati migliori"), ma non è un enum
 * validato: qui riconosciamo solo il caso "negativo" (critico), l'unico che ci interessa segnalare.
 * Falso in assenza di testo o se il testo non inizia esplicitamente con "negativo" — meglio un
 * falso negativo (nessun avviso) che un falso positivo su una frase ambigua.
 */
export function sentimentCritico(sentiment: string): boolean {
  return /^\s*negativo\b/i.test(sentiment);
}

/**
 * L'ultimo meeting (per data) di ciascun cliente, tra i meeting di tutti i clienti — usata dalla
 * Dashboard Amministratore per capire a colpo d'occhio "il cliente più recente ha lasciato un
 * segnale negativo?" senza dover aprire ogni scheda cliente. A parità di data vince l'ultimo
 * incontrato nell'array (assume input già ragionevolmente ordinato, ma non è un requisito: un
 * pareggio di data qui è un caso limite che non cambia la sostanza del segnale).
 */
export function ultimoMeetingPerCliente(meetings: MeetingClienteRow[]): Map<string, MeetingClienteRow> {
  const ultimo = new Map<string, MeetingClienteRow>();
  for (const m of meetings) {
    const attuale = ultimo.get(m.clienteId);
    if (!attuale || m.data >= attuale.data) ultimo.set(m.clienteId, m);
  }
  return ultimo;
}
