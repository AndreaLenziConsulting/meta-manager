"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type AccordionItemDef = { id: string; label: string; content: ReactNode };

/**
 * Macro-accordion di primo livello (KPI/Attività/Meeting sulla scheda cliente): esattamente UNA
 * voce aperta alla volta — "zero aperte" lascerebbe la pagina vuota con solo 3 voci, quindi non è
 * un vero multi-open. Controllato dal chiamante (stesso pattern di Tabs.tsx: nessuno stato interno),
 * il contenuto della voce aperta si sviluppa sotto la sua intestazione, non sostituisce le altre.
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
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = item.id === aperto;
        return (
          <div key={item.id} className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => onChange(item.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
              aria-expanded={isOpen}
            >
              <span className="font-heading font-bold text-ink-900 text-[15px]">{item.label}</span>
              <ChevronDown size={18} className={`text-ink-500 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && <div className="px-5 pb-5 pt-5 border-t border-ink-300/60">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
