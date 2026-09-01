/**
 * Confronto col periodo precedente (richiesto sotto ai numeri primari delle 6 tessere di
 * sintesi — vedi SintesiTessere.tsx). Pura funzione di calcolo, separata dalla presentazione
 * (stesso principio già seguito da valutazioneCampagna.ts): decide SE e QUANTO è cambiato un
 * valore, non come disegnarlo o se quel cambiamento sia "buono" — quella lettura dipende dalla
 * metrica (più investimento non è né un bene né un male) e resta nel componente.
 */
export type DirezioneVariazione = "aumento" | "diminuzione" | "invariato";

export type VariazionePeriodo = { percentuale: number; direzione: DirezioneVariazione };

/**
 * `null` quando il confronto non è calcolabile in modo onesto: valore assente in uno dei due
 * periodi, oppure periodo precedente a zero con periodo attuale diverso da zero (la percentuale
 * sarebbe infinita/senza senso — es. da 0 a 5 lead non è "+∞%", è un periodo precedente senza
 * dati di riferimento). Zero contro zero è invece un dato reale ("invariato"), non un'assenza.
 */
export function calcolaVariazionePeriodo(attuale: number | null, precedente: number | null): VariazionePeriodo | null {
  if (attuale === null || precedente === null || !Number.isFinite(attuale) || !Number.isFinite(precedente)) {
    return null;
  }
  if (precedente === 0) {
    return attuale === 0 ? { percentuale: 0, direzione: "invariato" } : null;
  }
  const percentuale = (attuale - precedente) / Math.abs(precedente);
  if (percentuale === 0) return { percentuale: 0, direzione: "invariato" };
  return { percentuale, direzione: percentuale > 0 ? "aumento" : "diminuzione" };
}
