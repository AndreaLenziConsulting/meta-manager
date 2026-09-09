"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Primitivo collassabile a MULTI-apertura (stato locale indipendente per istanza) — a differenza
 * di Accordion.tsx (una sola voce aperta alla volta, by design, non riusabile qui): nel redesign
 * Attività (08/09/2026) serve il contrario, più gruppi aperti insieme (per cliente nella vista
 * aggregata, per stato dentro AttivitaLista.tsx quando la lista è lunga). Nessun'opinione sullo
 * stile dell'header — il chiamante passa `titolo` come slot: uno stato ha già un header colorato
 * (raggruppaPerStato), un cliente ne ha uno semplice, lo stesso primitivo serve entrambi.
 */
export function GruppoCollassabile({
  titolo,
  defaultAperto = true,
  headerClassName,
  children,
}: {
  titolo: React.ReactNode;
  defaultAperto?: boolean;
  headerClassName?: string;
  children: React.ReactNode;
}) {
  const [aperto, setAperto] = useState(defaultAperto);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAperto((a) => !a)}
        className={cn("w-full flex items-center gap-2 cursor-pointer text-left", headerClassName)}
      >
        <ChevronDown size={14} className={cn("flex-shrink-0 transition-transform", !aperto && "-rotate-90")} />
        {titolo}
      </button>
      {aperto && children}
    </div>
  );
}
