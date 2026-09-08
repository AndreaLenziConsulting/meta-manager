import { PartyPopper } from "lucide-react";
import { formatDataBreve } from "@/lib/format";
import { STILE_LIVELLO } from "@/lib/statusStyles";

type FaseCompletata = { fase: string; completataIl: string };

/**
 * Banner "tappa raggiunta" — Fase 1 roadmap, vista milestone: notifica in-app quando una fase
 * della roadmap cliente passa tutta a "done" (vedi faseCompletata/fasiCompletateRecenti in
 * roadmap.ts, /api/fasi-completate). Un solo componente per due contesti — team (AttivitaTab.tsx,
 * dove il Gantt già vive) e cliente (KpiSection.tsx, l'unica superficie che il cliente vede sul
 * progresso del progetto): entrambi mostrano solo fase+data, mai il dettaglio delle attività —
 * quello resta riservato al team, coerente col gate già esistente in SchedaCliente.tsx. Tono
 * "successo" (verde), deliberatamente distinto dal tono d'attenzione di AvvisiOperativi.tsx:
 * questa è una buona notizia, non un avviso da guardare.
 */
export function FaseCompletataBanner({ fasi }: { fasi: FaseCompletata[] }) {
  if (fasi.length === 0) return null;
  const stile = STILE_LIVELLO.successo;

  return (
    <div className={`rounded-2xl border px-4 py-3 space-y-1.5 ${stile.classe}`}>
      {fasi.map((f) => (
        <div key={f.fase} className="flex items-center gap-2 text-xs font-semibold">
          <PartyPopper size={14} className="shrink-0" />
          <span>
            Fase <span className="font-bold">&quot;{f.fase}&quot;</span> completata il {formatDataBreve(f.completataIl)}
          </span>
        </div>
      ))}
    </div>
  );
}
