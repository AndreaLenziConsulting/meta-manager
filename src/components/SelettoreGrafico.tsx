"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";

export type OpzioneGrafico<T extends string> = { id: T; label: string; descrizione: string };

/**
 * Il menù a tendina con cui un riquadro di grafici sceglie quale mostrare: un grafico alla volta,
 * ognuno col suo nome e una riga che dice cosa fa vedere. Nato dentro BoxGrafici.tsx (i grafici del
 * marketing) e portato qui l'08/10/2026 quando anche il riquadro dei venditori ha avuto il suo
 * (AndamentoCommerciale.tsx): stesso comportamento nei due — si chiude cliccando fuori o con Esc.
 */
export function SelettoreGrafico<T extends string>({ opzioni, selezionato, onChange }: { opzioni: OpzioneGrafico<T>[]; selezionato: T; onChange: (id: T) => void }) {
  const [aperto, setAperto] = useState(false);
  const radice = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto) return;
    function suClic(e: MouseEvent) {
      if (radice.current && !radice.current.contains(e.target as Node)) setAperto(false);
    }
    function suTasto(e: KeyboardEvent) {
      if (e.key === "Escape") setAperto(false);
    }
    document.addEventListener("mousedown", suClic);
    document.addEventListener("keydown", suTasto);
    return () => {
      document.removeEventListener("mousedown", suClic);
      document.removeEventListener("keydown", suTasto);
    };
  }, [aperto]);

  const attivo = opzioni.find((o) => o.id === selezionato) ?? opzioni[0];

  return (
    <div className="relative" ref={radice}>
      <button
        type="button"
        onClick={() => setAperto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aperto}
        aria-label={`Grafico mostrato: ${attivo.label}. Clicca per cambiarlo`}
        className="flex items-center gap-2 min-h-10 rounded-lg border border-bordo-campo bg-surface-card px-3 py-2 text-sm text-ink-900 hover:border-brand transition cursor-pointer"
      >
        <LineChart size={16} aria-hidden="true" className="text-ink-500" />
        {attivo.label}
        <ChevronDown size={16} aria-hidden="true" className="text-ink-500" />
      </button>

      {aperto && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-alta)] p-2">
          {opzioni.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === selezionato}
              onClick={() => {
                onChange(o.id);
                setAperto(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${o.id === selezionato ? "bg-brand-light" : "hover:bg-surface"}`}
            >
              <p className={`text-sm font-semibold ${o.id === selezionato ? "text-brand" : "text-ink-900"}`}>{o.label}</p>
              <p className="text-xs text-ink-500">{o.descrizione}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
