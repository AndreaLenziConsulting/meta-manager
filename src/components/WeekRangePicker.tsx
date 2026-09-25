"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { formatSettimana } from "@/lib/format";
import { settimanaDiData } from "@/lib/kpi";
import { aggiungiGiorni, oggiIso } from "@/lib/roadmap";

type Props = {
  da: string; // YYYY-MM-DD, sempre un lunedì (chiave di settimana, vedi settimanaDiData in lib/kpi.ts)
  a: string; // YYYY-MM-DD, sempre un lunedì
  onChange: (da: string, a: string) => void;
};

function settimanaCorrente(): string {
  return settimanaDiData(oggiIso());
}

// Nessuna griglia-calendario come MonthRangePicker.tsx: le settimane non si allineano a una griglia
// annuale pulita come i mesi (una settimana può attraversare due mesi/anni), uno stepper prev/next
// ancorato al lunedì è più leggibile qui di 52 pulsanti per anno.
const PRESET: { label: string; range: () => [string, string] }[] = [
  { label: "Questa settimana", range: () => [settimanaCorrente(), settimanaCorrente()] },
  {
    label: "Settimana scorsa",
    range: () => {
      const s = aggiungiGiorni(settimanaCorrente(), -7);
      return [s, s];
    },
  },
  { label: "Ultime 4 settimane", range: () => [aggiungiGiorni(settimanaCorrente(), -21), settimanaCorrente()] },
  { label: "Ultime 8 settimane", range: () => [aggiungiGiorni(settimanaCorrente(), -49), settimanaCorrente()] },
];

function StepperSettimana({ titolo, valore, onChange }: { titolo: string; valore: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500 mb-1.5">{titolo}</p>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-300 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onChange(aggiungiGiorni(valore, -7))}
          className="w-6 h-6 rounded-md hover:bg-surface text-ink-500 flex items-center justify-center cursor-pointer flex-shrink-0"
          aria-label="Settimana precedente"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-ink-900 whitespace-nowrap">
          {formatSettimana(valore)} – {formatSettimana(aggiungiGiorni(valore, 6))}
        </span>
        <button
          type="button"
          onClick={() => onChange(aggiungiGiorni(valore, 7))}
          className="w-6 h-6 rounded-md hover:bg-surface text-ink-500 flex items-center justify-center cursor-pointer flex-shrink-0"
          aria-label="Settimana successiva"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * Selettore periodo a settimane (richiesta utente, 25/09/2026) — gemello di MonthRangePicker.tsx
 * ma per settimane: stesso pattern bottone + pannello dropdown + preset + validazione "Da precede
 * A", stessa forma di props (`da`/`a`/`onChange`). `da`/`a` sono sempre lunedì-chiave (mai una data
 * qualunque): lo stepper avanza/retrocede sempre di 7 giorni esatti, non può mai produrre un valore
 * fuori griglia. Mostrato da KpiSection.tsx SOLO nella vista team (mai sul link pubblico `code`),
 * al posto di MonthRangePicker quando l'utente sceglie la modalità "Settimana".
 */
export function WeekRangePicker({ da, a, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingDa, setPendingDa] = useState(da);
  const [pendingA, setPendingA] = useState(a);
  const [errore, setErrore] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function apri() {
    setPendingDa(da);
    setPendingA(a);
    setErrore(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function applica() {
    if (pendingDa > pendingA) {
      setErrore("La settimana di inizio deve precedere quella di fine.");
      return;
    }
    onChange(pendingDa, pendingA);
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : apri())}
        className="flex items-center gap-2 rounded-xl border border-[var(--glass-border-soft)] bg-surface-card backdrop-blur-lg supports-[backdrop-filter]:bg-[var(--glass-panel)] px-3 py-2 text-sm text-ink-900 shadow-sm hover:border-brand/40 transition cursor-pointer"
      >
        <Calendar size={14} className="text-ink-500" />
        {formatSettimana(da)} – {formatSettimana(aggiungiGiorni(a, 6))}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-[var(--glass-border-soft)] bg-surface-card backdrop-blur-lg supports-[backdrop-filter]:bg-[var(--glass-panel-strong)] shadow-lg p-4 flex flex-col sm:flex-row gap-4">
          <div className="sm:w-36 flex-shrink-0 sm:border-r border-b sm:border-b-0 border-ink-300/60 pb-3 sm:pb-0 sm:pr-3 space-y-0.5">
            {PRESET.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const [nDa, nA] = p.range();
                  onChange(nDa, nA);
                  setOpen(false);
                }}
                className="w-full text-left text-xs px-2 py-1.5 rounded-lg text-ink-700 hover:bg-surface transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            <StepperSettimana
              titolo="Da"
              valore={pendingDa}
              onChange={(v) => {
                setPendingDa(v);
                setErrore(null);
              }}
            />
            <StepperSettimana
              titolo="A"
              valore={pendingA}
              onChange={(v) => {
                setPendingA(v);
                setErrore(null);
              }}
            />

            {errore && <p className="text-xs text-red-600">{errore}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-300/60">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-ink-500 hover:bg-surface transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={applica}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-cta hover:bg-cta-dark text-white transition-colors cursor-pointer"
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
