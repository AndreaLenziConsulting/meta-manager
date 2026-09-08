import { Frown, HelpCircle, Meh, Smile, TrendingDown } from "lucide-react";
import { formatDataBreve } from "@/lib/format";
import { STILE_LIVELLO } from "@/lib/statusStyles";
import type { AndamentoSentiment as AndamentoSentimentDati, StatoSentiment } from "@/lib/sentimentCliente";

const ICONA: Record<StatoSentiment, typeof Smile> = { positivo: Smile, neutro: Meh, negativo: Frown, sconosciuto: HelpCircle };
// Stessa famiglia di tinte di statusStyles.ts (mai un colore inventato qui) — positivo/successo,
// negativo/critico, neutro/sconosciuto entrambi "neutro" (nessuna differenza di lettura tra "il
// cliente è nella media" e "il modello non ha seguito il formato atteso": in entrambi i casi non
// c'è un segnale d'allarme da mostrare).
const TONO: Record<StatoSentiment, keyof typeof STILE_LIVELLO> = {
  positivo: "successo", neutro: "neutro", negativo: "critico", sconosciuto: "neutro",
};

/**
 * Andamento nel tempo del sentiment rilevato nei meeting (Fase 1 roadmap, monitoraggio sentiment)
 * — striscia cronologica di icone (più vecchio a sinistra), non solo il flag "ultimo meeting
 * negativo" già mostrato nella Dashboard Amministratore (vedi andamentoSentiment in
 * sentimentCliente.ts, stessa funzione dietro entrambi). Team-only per costruzione: il chiamante
 * (MeetingTab.tsx) la monta solo nella vista clienteId, mai sul link pubblico `code` — il sentiment
 * non è mai un dato da mostrare al cliente finale su se stesso.
 */
export function AndamentoSentiment({ andamento }: { andamento: AndamentoSentimentDati }) {
  if (andamento.serie.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
      <p className="text-xs font-semibold text-ink-700 shrink-0">Andamento sentiment</p>
      <div className="flex items-center gap-1.5">
        {andamento.serie.map((p) => {
          const Icona = ICONA[p.stato];
          const stile = STILE_LIVELLO[TONO[p.stato]];
          return (
            <span
              key={p.meetingId}
              title={`${formatDataBreve(p.data)} — ${p.titolo || "(senza titolo)"} — ${p.stato}`}
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full border ${stile.classe}`}
            >
              <Icona size={13} />
            </span>
          );
        })}
      </div>
      {andamento.aRischio && (
        <span className="text-xs font-semibold text-red-600 inline-flex items-center gap-1 ml-auto">
          <TrendingDown size={13} /> clima in calo — segui da vicino
        </span>
      )}
    </div>
  );
}
