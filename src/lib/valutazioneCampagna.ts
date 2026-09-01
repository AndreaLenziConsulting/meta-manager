import { formatEuro } from "@/lib/format";

export type LivelloCampagna = "successo" | "attenzione" | "critico" | "non-valutabile";
export type EsitoValutazioneCampagna = { livello: LivelloCampagna; motivo: string };

// Più basso = più severo: "il peggio vince" fra le due dimensioni (stesso idioma di
// ORDINE_SEVERITA in src/lib/salute.ts). "non-valutabile" ha il numero più alto — perde SEMPRE
// contro un verdetto reale su una delle due dimensioni, vince solo se ENTRAMBE lo sono.
const ORDINE_SEVERITA: Record<LivelloCampagna, number> = { critico: 0, attenzione: 1, successo: 2, "non-valutabile": 3 };

const SOGLIA_ATTENZIONE_CPL = 1.0; // fino al target incluso -> successo
const SOGLIA_CRITICO_CPL = 1.25; // fino a +25% sul target -> attenzione, oltre -> critico
// Esportata: riusata da avvisiOperativi.ts (blocco 4) per segnalare le campagne con frequenza alta
// nel pannello — stessa soglia, mai un secondo "2.5" duplicato altrove.
export const SOGLIA_FREQUENZA = 2.5; // oltre -> attenzione (mai critico da sola, per spec)

function valutaCpl(costoPerLead: number | null, targetCpl: number | null): { livello: LivelloCampagna; motivo: string } {
  if (targetCpl === null || targetCpl <= 0 || costoPerLead === null) {
    return { livello: "non-valutabile", motivo: "Nessun target di Costo per Lead impostato per questo cliente" };
  }
  const rapporto = costoPerLead / targetCpl;
  if (rapporto <= SOGLIA_ATTENZIONE_CPL) {
    return { livello: "successo", motivo: `Costo per Lead a ${formatEuro(costoPerLead)}, entro il target di ${formatEuro(targetCpl)}` };
  }
  const percentualeSopra = Math.round((rapporto - 1) * 100);
  const motivo = `Costo per Lead a ${formatEuro(costoPerLead)}, il ${percentualeSopra}% sopra il target di ${formatEuro(targetCpl)}`;
  return { livello: rapporto <= SOGLIA_CRITICO_CPL ? "attenzione" : "critico", motivo };
}

function valutaFrequenza(frequenza: number | null): { livello: LivelloCampagna; motivo: string } {
  if (frequenza === null) {
    return { livello: "non-valutabile", motivo: "Frequenza non disponibile" };
  }
  if (frequenza > SOGLIA_FREQUENZA) {
    return { livello: "attenzione", motivo: `Frequenza a ${frequenza.toFixed(2)}, sopra la soglia di ${SOGLIA_FREQUENZA}` };
  }
  return { livello: "successo", motivo: `Frequenza a ${frequenza.toFixed(2)}, sotto la soglia di ${SOGLIA_FREQUENZA}` };
}

/**
 * Pallino verde/giallo/rosso per singola campagna (blocco 7 del redesign KPI). NON riusa
 * calcolaSalute/classifica di src/lib/salute.ts: soglie diverse (0,8x/1,2x, per il giudizio di
 * salute a livello di TOTALE cliente) da quelle qui (1,0x/1,25x, decisione esplicita dell'utente,
 * per SINGOLA campagna) — è l'errore più facile da fare perché una funzione che sembra fare la
 * cosa giusta esiste già, ma non è quella giusta per questo scopo.
 *
 * Combinazione "il peggio vince" fra le due dimensioni indipendenti (CPL vs target, Frequenza vs
 * soglia fissa): se sono entrambe al livello vincente, `motivo` cita tutte e due le ragioni, non
 * solo una. "non-valutabile" (pallino grigio) non è un verde finto: usato solo quando davvero non
 * c'è base di giudizio su nessuna delle due dimensioni.
 */
export function valutaCampagna(input: {
  costoPerLead: number | null;
  frequenza: number | null;
  targetCpl: number | null;
}): EsitoValutazioneCampagna {
  const cpl = valutaCpl(input.costoPerLead, input.targetCpl);
  const freq = valutaFrequenza(input.frequenza);
  const livello = ORDINE_SEVERITA[cpl.livello] <= ORDINE_SEVERITA[freq.livello] ? cpl.livello : freq.livello;
  const motivo = [cpl, freq]
    .filter((r) => r.livello === livello)
    .map((r) => r.motivo)
    .join(" — ");
  return { livello, motivo };
}
