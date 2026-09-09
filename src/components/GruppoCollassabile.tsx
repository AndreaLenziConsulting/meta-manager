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
  // Modalità controllata (opzionale): il chiamante tiene lo stato aperto/chiuso invece di
  // lasciarlo interno — serve quando serve REAGIRE all'apertura (es. AttivitaLista.tsx applica
  // `rounded-b-2xl` all'header solo da chiuso, visto che niente `overflow-hidden` clippa gli
  // angoli — vedi il commento lì sul perché). Se assente, si comporta come prima (stato interno).
  aperto: apertoControllato,
  onToggle,
  headerClassName,
  children,
}: {
  titolo: React.ReactNode;
  defaultAperto?: boolean;
  aperto?: boolean;
  onToggle?: () => void;
  headerClassName?: string;
  children: React.ReactNode;
}) {
  const [apertoInterno, setApertoInterno] = useState(defaultAperto);
  const aperto = apertoControllato ?? apertoInterno;

  function handleClick() {
    if (onToggle) onToggle();
    else setApertoInterno((a) => !a);
  }

  return (
    <div>
      <button type="button" onClick={handleClick} className={cn("w-full flex items-center gap-2 cursor-pointer text-left", headerClassName)}>
        <ChevronDown size={14} className={cn("flex-shrink-0 transition-transform", !aperto && "-rotate-90")} />
        {titolo}
      </button>
      {aperto && children}
    </div>
  );
}
