"use client";

import type { ReactNode } from "react";
import { Tabs } from "@/components/Tabs";

export type AccordionItemDef = { id: string; label: string; content: ReactNode };

/**
 * Macro-accordion di primo livello (KPI/Attività/Meeting sulla scheda cliente): esattamente UNA
 * voce aperta alla volta — "zero aperte" lascerebbe la pagina vuota con solo 3 voci, quindi non è
 * un vero multi-open. Etichette in riga orizzontale (riusa Tabs.tsx, stesso stile a pillole già
 * in uso altrove nell'app — non 3 card impilate verticalmente, un'iterazione precedente), il
 * contenuto della voce attiva si sviluppa sotto l'intera riga di etichette. Controllato dal
 * chiamante (stesso pattern di Tabs.tsx: nessuno stato interno).
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
    <div className="space-y-5">
      <Tabs tabs={items.map(({ id, label }) => ({ id, label }))} attivo={aperto} onChange={onChange} />
      {attivo?.content}
    </div>
  );
}
