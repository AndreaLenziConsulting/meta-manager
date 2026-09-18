import { formatEuro, formatNumero } from "@/lib/format";
import type { MetricaPacing } from "@/lib/targetPacing";

/** Estratto da PacingTargetChart.tsx (grafico "Target mensili") per essere riusato identico anche
 * da PacingVenditoriChart.tsx (Fase 2, venditori) — stessa spec "meter" della skill dataviz in
 * entrambi i casi, un solo posto che la implementa. */
export const ETICHETTA_STATO_PACING: Record<MetricaPacing["stato"], string> = {
  successo: "In linea con il ritmo atteso",
  attenzione: "Leggermente indietro, recuperabile",
  critico: "Indietro rispetto al ritmo atteso",
};

export const COLORE_STATO_PACING: Record<MetricaPacing["stato"], string> = {
  successo: "var(--pos)",
  attenzione: "var(--warn)",
  critico: "var(--neg)",
};

/** Un blocco di pacing (titolo opzionale + marker "Oggi" + righe) — ripetuto una volta per ogni
 * sotto-gruppo (categoria commerciale, venditore, "Totale sede", ...) più un eventuale totale. Il
 * marker si ripete identico in ogni blocco invece di uno condiviso per l'intero componente: stessa
 * frazione di mese (`fraz` è la stessa per tutti i blocchi di un dato grafico), ma bloccarlo a
 * un'unica posizione assoluta attraverso un numero variabile di blocchi impilati avrebbe richiesto
 * un calcolo di altezza dinamico fragile per un guadagno visivo minimo. */
export function BloccoPacing({ titolo, metriche, fraz, sottotitolo }: { titolo?: string; metriche: MetricaPacing[]; fraz: number; sottotitolo?: string }) {
  if (metriche.length === 0) return null;
  return (
    <div>
      {(titolo || sottotitolo) && (
        <div className="flex items-baseline justify-between gap-2 mb-2">
          {titolo && <p className="text-xs font-semibold text-ink-700">{titolo}</p>}
          {sottotitolo && <p className="text-[11px] text-ink-500">{sottotitolo}</p>}
        </div>
      )}
      <div className="relative pt-5">
        {/* Colore da --baseline (var(--baseline)), lo stesso token della guida verticale al
            passaggio del mouse in TrendChart.tsx — non una classe Tailwind ink-*: qui il progetto ha
            solo gli step 900/700/500/300 mappati (vedi globals.css), niente step intermedi come
            ink-400 utilizzabili come classe. */}
        <div className="absolute top-5 bottom-0 w-px z-10 pointer-events-none" style={{ left: `${fraz * 100}%`, backgroundColor: "var(--baseline)" }} />
        <span
          className="absolute top-0 z-10 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap pointer-events-none"
          style={{ left: `${fraz * 100}%`, color: "var(--text-muted)" }}
        >
          Oggi
        </span>
        <div className="space-y-4">
          {metriche.map((m) => (
            <RigaPacing key={m.chiave} metrica={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RigaPacing({ metrica }: { metrica: MetricaPacing }) {
  const formatValore = metrica.unita === "euro" ? formatEuro : formatNumero;
  const percentuale = metrica.targetMensile > 0 ? (metrica.attuale / metrica.targetMensile) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-ink-700">{metrica.etichetta}</span>
        <span className="text-xs text-ink-500 tabular-nums">
          {formatValore(metrica.attuale)} <span className="text-ink-500/60">/</span> {formatValore(metrica.targetMensile)}
        </span>
      </div>
      {/* Traccia grigia neutra (gray-200, non ink-*: nessuno step abbastanza chiaro mappato — vedi
          il commento sul marker sopra) + riempimento colorato per stato — spec "meter" della skill
          dataviz: il riempimento porta la severità, la traccia è solo il contenitore neutro. */}
      <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(Math.max(percentuale, 0), 100)}%`, backgroundColor: COLORE_STATO_PACING[metrica.stato] }}
        />
      </div>
      <p className="text-[11px] mt-1" style={{ color: COLORE_STATO_PACING[metrica.stato] }}>
        {ETICHETTA_STATO_PACING[metrica.stato]}
      </p>
    </div>
  );
}
