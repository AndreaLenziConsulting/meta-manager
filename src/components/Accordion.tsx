"use client";

import type { ReactNode } from "react";
import { Tabs } from "@/components/Tabs";

export type AccordionItemDef = { id: string; label: string; content: ReactNode };

/**
 * Macro-navigazione di primo livello (KPI/Attività/Meeting sulla scheda cliente): riga
 * orizzontale di etichette a pillola (riusa Tabs.tsx, stesso stile già in uso altrove nell'app),
 * il contenuto della voce attiva si sviluppa sotto l'intera riga. Esattamente UNA voce aperta
 * alla volta — con solo 3 voci, "zero aperte" lascerebbe la pagina vuota. Controllato dal
 * chiamante (nessuno stato interno, stesso pattern di Tabs.tsx).
 *
 * Nota: una versione con "schede" a linguetta di cartellina (angolo tagliato) è stata provata e
 * scartata — da riprendere in un secondo momento, non ora.
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
