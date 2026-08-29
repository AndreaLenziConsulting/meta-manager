"use client";

import type { ReactNode } from "react";

export type AccordionItemDef = { id: string; label: string; content: ReactNode };

// Dimensione (px) del taglio ad angolo in alto a sinistra di ogni "scheda" attiva — lo stesso
// taglio diagonale di una linguetta di cartellina, non un angolo arrotondato. BORDO è lo
// spessore del bordo disegnato: due sagome clip-path identiche (una del colore del bordo, una
// del colore di sfondo, quest'ultima rimpicciolita di BORDO su ogni lato) — un normale
// `border` su un elemento con clip-path NON disegna alcuna linea lungo il taglio diagonale
// stesso (il clip-path ritaglia via i pixel del bordo esistente, non ne crea uno nuovo lungo il
// nuovo bordo della forma): senza questo doppio strato la linguetta resta con un "buco" visibile
// proprio nell'angolo tagliato invece di un contorno continuo.
const TAGLIO = 12;
const BORDO = 1;

function sagoma(taglio: number) {
  return `polygon(${taglio}px 0, 100% 0, 100% 100%, 0 100%, 0 ${taglio}px)`;
}

/**
 * Macro-navigazione di primo livello (KPI/Attività/Meeting sulla scheda cliente): "schede" in
 * stile linguetta di cartellina, non pillole (Tabs.tsx resta quello per gli switcher interni,
 * es. Per tipo/Per singola campagna) — la scheda attiva ha un angolo tagliato in alto a sinistra
 * con un contorno continuo, le inattive sono solo testo, senza riquadro. Esattamente UNA voce
 * aperta alla volta — con solo 3 voci, "zero aperte" lascerebbe la pagina vuota. Controllato dal
 * chiamante (nessuno stato interno, stesso pattern di Tabs.tsx).
 *
 * Nessun pannello bianco-su-bianco sotto le schede (tolto su segnalazione esplicita) — il
 * contenuto della voce attiva fluisce direttamente sullo sfondo grigio della pagina, come il
 * resto della dashboard (Card bianche isolate, non annidate in un'altra card).
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
              className={isOpen ? "relative px-5 py-1.5 font-heading font-bold text-brand" : "px-4 py-1.5 text-sm font-semibold text-ink-500 transition hover:text-ink-700"}
            >
              {isOpen && (
                <>
                  {/* Strato bordo: riempie l'intera sagoma tagliata col colore del bordo. */}
                  <span aria-hidden="true" className="absolute inset-0 bg-ink-300" style={{ clipPath: sagoma(TAGLIO) }} />
                  {/* Strato sfondo: stessa sagoma, rimpicciolita di BORDO su ogni lato — il bordo
                      residuo visibile è esattamente lo strato sottostante, spesso BORDO px,
                      incluso lungo il taglio diagonale. */}
                  <span
                    aria-hidden="true"
                    className="absolute bg-surface-card"
                    style={{ inset: `${BORDO}px`, clipPath: sagoma(TAGLIO - BORDO) }}
                  />
                </>
              )}
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </div>
      {attivo?.content}
    </div>
  );
}
