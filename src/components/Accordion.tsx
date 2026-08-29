"use client";

import type { ReactNode } from "react";

export type AccordionItemDef = { id: string; label: string; content: ReactNode };

// Dimensione (px) del taglio ad angolo in alto a sinistra di ogni "scheda" attiva — lo stesso
// taglio diagonale di una linguetta di cartellina, non un angolo arrotondato.
const TAGLIO = 14;

/**
 * Macro-navigazione di primo livello (KPI/Attività/Meeting sulla scheda cliente): "schede" in
 * stile linguetta di cartellina, non pillole (Tabs.tsx resta quello per gli switcher interni,
 * es. Per tipo/Per singola campagna) — la scheda attiva ha un angolo tagliato in alto a sinistra
 * e si fonde visivamente col pannello sottostante (stesso bordo, nessuna cucitura visibile fra i
 * due); le schede inattive sono solo testo, senza riquadro. Esattamente UNA voce aperta alla
 * volta — con solo 3 voci, "zero aperte" lascerebbe la pagina vuota. Controllato dal chiamante
 * (nessuno stato interno, stesso pattern di Tabs.tsx).
 */
export function Accordion({
  items,
  aperto,
  onChange,
}: {
  items: AccordionItemDef[];
  aperto: string;
  onChange: (id: string) => void;
}) {
  const attivo = items.find((item) => item.id === aperto) ?? items[0];

  return (
    <div>
      <div className="flex items-end gap-1 pl-4">
        {items.map((item) => {
          const isOpen = item.id === aperto;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-expanded={isOpen}
              className={
                isOpen
                  ? "relative z-10 -mb-px border border-b-0 border-ink-300 bg-surface-card px-5 py-3 font-heading font-bold text-brand"
                  : "px-4 py-3 text-sm font-semibold text-ink-500 transition hover:text-ink-700"
              }
              style={isOpen ? { clipPath: `polygon(${TAGLIO}px 0, 100% 0, 100% 100%, 0 100%, 0 ${TAGLIO}px)` } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {attivo && (
        <div className="relative z-0 rounded-b-2xl rounded-tr-2xl border border-ink-300 bg-surface-card p-5">
          {attivo.content}
        </div>
      )}
    </div>
  );
}
