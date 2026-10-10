"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fraseLavori, frasiNumeri, quandoScade, type SintesiLavori } from "@/lib/sintesiCliente";
import type { KpiGroup } from "@/types/kpi";

/** Come torna GET /api/sintesi-cliente. */
type Lavori = { oggi: string; lavori: SintesiLavori | null };

/**
 * La sintesi in cima alla pagina del cliente (09/10/2026, prima voce della Fase 2 della roadmap):
 * poche righe che dicono com'è andato il periodo, a che punto sono i lavori e cosa serve da lui.
 * Tutte le regole su cosa dire stanno in src/lib/sintesiCliente.ts; qui si legge lo stato dei lavori
 * e si disegna.
 *
 * Due posti, lo stesso testo:
 *   - sul link pubblico (`code`) sta in alto, prima delle tessere: è la prima cosa che il cliente legge;
 *   - nella scheda del team sta sotto le tessere, chiusa finché non la si apre: serve a sapere cosa
 *     legge il cliente, senza togliere la prima schermata ai numeri (audit UX del 06/10/2026).
 * In entrambi i numeri sono quelli che vede il cliente: spesa e contatti da Meta, appuntamenti e
 * vendite solo se inseriti a mano. Ciò che il team legge in più da GHL sul link pubblico non arriva,
 * e quindi non entra nella sintesi.
 */
export function SintesiCliente({
  code,
  clienteId,
  inizio,
  totale,
  precedente,
  confronto,
  commercialiInseriti,
  nomeSede,
  campagneScelteAMano,
}: {
  code?: string;
  clienteId?: string;
  /** Come comincia la frase dei numeri: "Negli ultimi 30 giorni". */
  inizio: string;
  totale: KpiGroup;
  precedente: KpiGroup | null;
  /** Con cosa si confronta: "al periodo precedente", oppure "a" e le date scelte a mano. */
  confronto: string;
  commercialiInseriti: boolean;
  /** Solo se il cliente ha più sedi: i numeri sono di questa. */
  nomeSede?: string;
  campagneScelteAMano: boolean;
}) {
  const vistaTeam = !code;
  const [lavori, setLavori] = useState<Lavori | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const parametro = code ? `code=${encodeURIComponent(code)}` : `clienteId=${encodeURIComponent(clienteId ?? "")}`;
    fetch(`/api/sintesi-cliente?${parametro}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Lavori | null) => setLavori(body))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Senza lo stato dei lavori la sintesi resta con i soli numeri: meglio di un errore in cima alla pagina.
        setLavori(null);
      });
    return () => controller.abort();
  }, [code, clienteId]);

  const numeri = frasiNumeri({ inizio, totale, precedente, confronto, commercialiInseriti });
  const stato = lavori?.lavori ?? null;

  const contenuto = (
    <div className="space-y-3 text-sm leading-[22px] text-ink-700">
      <p>
        {numeri.join(" ")}
        {campagneScelteAMano && <span className="text-ink-500"> (Solo le campagne selezionate.)</span>}
      </p>
      {stato?.avanzamento && (
        <p>
          <strong className="font-semibold text-ink-900">A che punto siamo:</strong> {fraseLavori(stato.avanzamento)}
        </p>
      )}
      {stato && lavori && stato.serveDaTe.length > 0 && (
        <div>
          <p>
            <strong className="font-semibold text-ink-900">Serve da te:</strong>
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {stato.serveDaTe.map((a) => (
              <li key={`${a.descrizione}|${a.scadenza}`}>
                {a.descrizione} <span className={a.giorniDiRitardo > 0 ? "font-semibold text-critico" : "text-ink-500"}>— {quandoScade(a, lavori.oggi)}</span>
              </li>
            ))}
            {stato.altreDaTe > 0 && <li className="text-ink-500">e {stato.altreDaTe === 1 ? "un'altra" : `altre ${stato.altreDaTe}`}</li>}
          </ul>
        </div>
      )}
      {stato && stato.serveDaTe.length === 0 && (
        <p>
          <strong className="font-semibold text-ink-900">Serve da te:</strong> al momento nulla.
        </p>
      )}
    </div>
  );

  const titolo = nomeSede ? `In sintesi · ${nomeSede}` : "In sintesi";

  if (vistaTeam) {
    return (
      <details className="group rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-card)]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-heading text-base font-bold text-ink-900">La sintesi che legge il cliente</span>
            <span className="ml-2 text-xs text-ink-500">in cima alla sua pagina</span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-ink-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-linea px-5 py-4">{contenuto}</div>
      </details>
    );
  }

  return (
    <section aria-label="In sintesi" className="rounded-xl border border-bordo-card border-l-4 border-l-brand bg-surface-card px-5 py-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-2 font-heading text-xl leading-[26px] font-bold text-ink-900">{titolo}</h2>
      {contenuto}
    </section>
  );
}
