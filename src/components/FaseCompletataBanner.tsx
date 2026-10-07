import { formatDataBreve } from "@/lib/format";
import { Nota } from "@/components/ui/Nota";

type FaseCompletata = { fase: string; completataIl: string };

/**
 * "Tappa raggiunta" — Fase 1 roadmap, vista milestone: notifica in-app quando una fase della
 * roadmap cliente passa tutta a "done" (vedi faseCompletata/fasiCompletateRecenti in roadmap.ts,
 * /api/fasi-completate). Un solo componente per due contesti — team (AttivitaTab.tsx, dove il Gantt
 * già vive) e cliente (KpiSection.tsx, l'unica superficie che il cliente vede sul progresso del
 * progetto): entrambi mostrano solo fase+data, mai il dettaglio delle attività — quello resta
 * riservato al team, coerente col gate già esistente in SchedaCliente.tsx. Nota del Design System
 * ALC in tono "ok", distinto dal tono degli avvisi operativi: è una buona notizia.
 */
export function FaseCompletataBanner({ fasi }: { fasi: FaseCompletata[] }) {
  if (fasi.length === 0) return null;

  return (
    <Nota tono="ok" etichetta={fasi.length === 1 ? "Tappa raggiunta" : "Tappe raggiunte"} compatta>
      {fasi.map((f) => (
        <p key={f.fase}>
          Fase <strong className="font-bold text-ink-900">{f.fase}</strong> completata il {formatDataBreve(f.completataIl)}.
        </p>
      ))}
    </Nota>
  );
}
