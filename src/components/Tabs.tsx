"use client";

import type { KeyboardEvent } from "react";

export type TabDef = { id: string; label: string };

/**
 * Selettore a schede (segmenti). Ruoli ARIA da scheda (`tablist`/`tab`/`aria-selected`) e frecce
 * sinistra/destra per passare da una all'altra: un solo punto di Tab per tutto il gruppo. La scheda
 * attiva è `superficie` con testo `inchiostro`; le altre `testo-secondario`, che passa 4,5:1 sul
 * fondo `sfondo` (prima il grigio delle schede inattive era a 2,9:1).
 */
export function Tabs({
  tabs,
  attivo,
  onChange,
  etichetta,
}: {
  tabs: TabDef[];
  attivo: string;
  onChange: (id: string) => void;
  /** Nome del gruppo per gli screen reader (es. "Sezioni del cliente"). */
  etichetta?: string;
}) {
  function suTasto(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const indice = tabs.findIndex((t) => t.id === attivo);
    if (indice < 0) return;
    e.preventDefault();
    const prossimoIndice = (indice + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    onChange(tabs[prossimoIndice].id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[prossimoIndice]?.focus();
  }

  return (
    <div role="tablist" aria-label={etichetta} onKeyDown={suTasto} className="flex flex-wrap gap-1 bg-surface border border-linea p-1 rounded-[20px] w-fit">
      {tabs.map((t) => {
        const selezionata = attivo === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selezionata}
            tabIndex={selezionata ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`min-h-8 px-4 py-1.5 rounded-full text-[13px] leading-[18px] font-semibold cursor-pointer transition-colors ${
              selezionata ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
