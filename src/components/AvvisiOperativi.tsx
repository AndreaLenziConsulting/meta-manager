"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AvvisoOperativo, TonoAvviso } from "@/lib/avvisiOperativi";
import { STILE_LIVELLO, type LivelloStato } from "@/lib/statusStyles";

const TONO_A_LIVELLO: Record<TonoAvviso, LivelloStato> = { attenzione: "attenzione", "da-sistemare": "critico", "da-sapere": "info" };
const ETICHETTA_TONO: Record<TonoAvviso, string> = { attenzione: "attenzione", "da-sistemare": "da sistemare", "da-sapere": "da sapere" };
const ORDINE_TONO: TonoAvviso[] = ["attenzione", "da-sistemare", "da-sapere"];

/**
 * Blocco 4 del redesign KPI — pannello comprimibile di avvisi operativi automatici, ispirato a "Il
 * punto in breve" di hygge-casa-dashboard. Il chiamante (KpiSection.tsx) lo gated su
 * Boolean(clienteId): mai sul link pubblico `code`, mai per un ruolo commerciale (che non arriva
 * mai a un clienteId, vedi authz.ts). Default APERTO, con un riepilogo compatto in testata sempre
 * visibile (anche da chiuso) — nessuno stato vuoto nascosto: "Nessun avviso al momento" è comunque
 * un'informazione, non l'assenza del pannello.
 */
export function AvvisiOperativi({ avvisi }: { avvisi: AvvisoOperativo[] }) {
  const [aperto, setAperto] = useState(true);

  const conteggi = ORDINE_TONO.map((tono) => ({ tono, count: avvisi.filter((a) => a.tono === tono).length })).filter(
    (c) => c.count > 0
  );
  const riepilogo =
    avvisi.length === 0
      ? "Nessun avviso al momento"
      : `${avvisi.length} ${avvisi.length === 1 ? "avviso" : "avvisi"} — ${conteggi
          .map((c) => `${c.count} ${ETICHETTA_TONO[c.tono]}`)
          .join(", ")}`;

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5">
      <button type="button" onClick={() => setAperto((a) => !a)} className="w-full flex items-center justify-between gap-3 cursor-pointer">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1 h-5 rounded-full bg-brand shrink-0" />
          <h3 className="font-heading font-bold text-ink-900 text-[15px] shrink-0">Avvisi operativi</h3>
          <span className="text-xs text-ink-500 truncate">{riepilogo}</span>
        </div>
        <ChevronDown size={16} className={`text-ink-500 shrink-0 transition-transform ${aperto ? "rotate-180" : ""}`} />
      </button>

      {aperto && avvisi.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {avvisi.map((a) => {
            const stile = STILE_LIVELLO[TONO_A_LIVELLO[a.tono]];
            return (
              <div key={a.id} className={`rounded-xl border px-3.5 py-2.5 ${stile.classe}`}>
                <p className="text-xs font-semibold">{a.titolo}</p>
                <p className="text-xs mt-0.5 opacity-90">{a.messaggio}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
