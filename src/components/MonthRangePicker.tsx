"use client";

import { useEffect, useRef, useState } from "react";
import { MESI_BREVI, formatMese } from "@/lib/format";

type Props = {
  da: string; // YYYY-MM
  a: string; // YYYY-MM
  onChange: (da: string, a: string) => void;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

function meseIndietro(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

const PRESET: { label: string; range: () => [string, string] }[] = [
  { label: "Mese corrente", range: () => [meseCorrente(), meseCorrente()] },
  { label: "Ultimi 3 mesi", range: () => [meseIndietro(2), meseCorrente()] },
  { label: "Ultimi 6 mesi", range: () => [meseIndietro(5), meseCorrente()] },
  { label: "Anno corrente", range: () => [`${new Date().getFullYear()}-01`, meseCorrente()] },
  {
    label: "Anno precedente",
    range: () => {
      const y = new Date().getFullYear() - 1;
      return [`${y}-01`, `${y}-12`];
    },
  },
];

function MiniCalendar({
  titolo,
  year,
  onYearChange,
  selected,
  onSelect,
}: {
  titolo: string;
  year: number;
  onYearChange: (y: number) => void;
  selected: string;
  onSelect: (mese: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500 mb-1.5">{titolo}</p>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => onYearChange(year - 1)}
          className="w-6 h-6 rounded-md hover:bg-surface text-ink-500 flex items-center justify-center cursor-pointer"
          aria-label="Anno precedente"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-ink-900">{year}</span>
        <button
          type="button"
          onClick={() => onYearChange(year + 1)}
          className="w-6 h-6 rounded-md hover:bg-surface text-ink-500 flex items-center justify-center cursor-pointer"
          aria-label="Anno successivo"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {MESI_BREVI.map((nome, i) => {
          const value = `${year}-${pad(i + 1)}`;
          const isSelected = value === selected;
          return (
            <button
              key={nome}
              type="button"
              onClick={() => onSelect(value)}
              className={`text-xs rounded-lg py-1.5 transition-colors cursor-pointer ${
                isSelected ? "bg-brand text-white font-semibold" : "text-ink-700 hover:bg-surface"
              }`}
            >
              {nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthRangePicker({ da, a, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingDa, setPendingDa] = useState(da);
  const [pendingA, setPendingA] = useState(a);
  const [daYear, setDaYear] = useState(Number(da.slice(0, 4)));
  const [aYear, setAYear] = useState(Number(a.slice(0, 4)));
  const [errore, setErrore] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function apri() {
    setPendingDa(da);
    setPendingA(a);
    setDaYear(Number(da.slice(0, 4)));
    setAYear(Number(a.slice(0, 4)));
    setErrore(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function applica() {
    if (pendingDa > pendingA) {
      setErrore("La data di inizio deve precedere quella di fine.");
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
        className="flex items-center gap-2 rounded-xl border border-ink-300 bg-surface-card px-3 py-2 text-sm text-ink-900 shadow-sm hover:border-brand/40 transition cursor-pointer"
      >
        <CalendarIcon />
        {formatMese(da)} – {formatMese(a)}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-ink-300 bg-surface-card shadow-lg p-4 flex flex-col sm:flex-row gap-4">
          <div className="sm:w-32 flex-shrink-0 sm:border-r border-b sm:border-b-0 border-ink-300/60 pb-3 sm:pb-0 sm:pr-3 space-y-0.5">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MiniCalendar
                titolo="Da"
                year={daYear}
                onYearChange={setDaYear}
                selected={pendingDa}
                onSelect={(m) => {
                  setPendingDa(m);
                  setErrore(null);
                }}
              />
              <MiniCalendar
                titolo="A"
                year={aYear}
                onYearChange={setAYear}
                selected={pendingA}
                onSelect={(m) => {
                  setPendingA(m);
                  setErrore(null);
                }}
              />
            </div>

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

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
