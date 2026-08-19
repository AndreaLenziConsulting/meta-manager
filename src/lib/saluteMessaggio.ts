import type { ValutazioneSalute } from "@/lib/salute";
import { formatEuro } from "@/lib/format";

/**
 * Testo del richiamo "solo per il team" sulla Scheda Cliente (mai sul link pubblico `code`, vedi
 * KpiDashboard.tsx) — un solo punto di verità su quando mostrarlo: `null` quando non c'è davvero
 * nulla da segnalare (stato non critico e nessuna attività in ritardo), altrimenti il motivo
 * composto. Stessa logica di giudizio ads della dashboard admin (calcolaSalute in lib/salute.ts),
 * qui applicata al periodo scelto dall'utente sulla scheda invece che a una finestra fissa.
 */
export function formatMotivoIntervento(valutazione: ValutazioneSalute, attivitaInRitardoCount: number): string | null {
  const parti: string[] = [];

  if (
    valutazione.stato === "interveni" &&
    valutazione.valoreAttuale !== null &&
    valutazione.targetUsato !== null &&
    valutazione.targetUsato > 0
  ) {
    const percentualeSopra = Math.round((valutazione.valoreAttuale / valutazione.targetUsato - 1) * 100);
    const metrica = valutazione.metricaUsata === "vendita" ? "CPA su vendita" : "Costo per lead";
    parti.push(
      `${metrica} a ${formatEuro(valutazione.valoreAttuale)}, il ${percentualeSopra}% sopra il target di ${formatEuro(valutazione.targetUsato)}`
    );
  }

  if (attivitaInRitardoCount > 0) {
    parti.push(
      attivitaInRitardoCount === 1 ? "1 attività aperta è in ritardo" : `${attivitaInRitardoCount} attività aperte sono in ritardo`
    );
  }

  if (parti.length === 0) return null;
  return `${parti.join(" — ")}.`;
}
