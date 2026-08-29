"use client";

import type { ReactNode } from "react";

export type AccordionItemDef = { id: string; label: string; content: ReactNode };

// Dimensione (px) del taglio ad angolo in alto a sinistra di ogni "scheda" attiva — lo stesso
// taglio diagonale di una linguetta di cartellina, non un angolo arrotondato.
const TAGLIO = 12;

/**
 * Macro-navigazione di primo livello (KPI/Attività/Meeting sulla scheda cliente): "schede" in
 * stile linguetta di cartellina, non pillole (Tabs.tsx resta quello per gli switcher interni,
 * es. Per tipo/Per singola campagna) — la scheda attiva ha un angolo tagliato in alto a sinistra,
 * le inattive sono solo testo, senza riquadro. Esattamente UNA voce aperta alla volta — con solo
 * 3 voci, "zero aperte" lascerebbe la pagina vuota. Controllato dal chiamante (nessuno stato
 * interno, stesso pattern di Tabs.tsx).
 *
 * Nessun pannello bianco-su-bianco sotto le schede (tolto su segnalazione esplicita: due box
 * dello stesso colore, uno dentro l'altro, leggevano pesanti) — il contenuto della voce attiva
 * fluisce direttamente sullo sfondo grigio della pagina, esattamente come il resto della
 * dashboard (Card bianche isolate, non annidate in un'altra card). La scheda attiva ha
 * un'ombra leggera propria (invece di fondersi col bordo di un pannello che non esiste più) per
 * restare comunque leggibile come una linguetta sollevata, non un testo piatto.
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
    <div className="space-y-4">
      <div className="flex items-end gap-1">
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
                  ? "border border-ink-300 bg-surface-card px-5 py-1.5 font-heading font-bold text-brand shadow-sm"
                  : "px-4 py-1.5 text-sm font-semibold text-ink-500 transition hover:text-ink-700"
              }
              style={isOpen ? { clipPath: `polygon(${TAGLIO}px 0, 100% 0, 100% 100%, 0 100%, 0 ${TAGLIO}px)` } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {attivo?.content}
    </div>
  );
}
