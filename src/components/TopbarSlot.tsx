"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Slot per iniettare contenuto nella barra sticky di DashboardShell.tsx da un componente di pagina
 * che non ne fa strutturalmente parte (oggi solo ClienteHeader.tsx) — redesign "Vetro ALC"
 * (09/09/2026), topbar unificata: il nome cliente deve restare visibile durante lo scroll, ma
 * DashboardShell avvolge OGNI rotta sotto /dashboard e non ha motivo di conoscere il concetto di
 * "cliente". Context (non prop-drilling): porta il nodo DOM del contenitore vuoto dentro la barra
 * sticky fino a chi lo consuma, ovunque sia nell'albero — DashboardShell non deve sapere COSA ci
 * finisce dentro, il consumatore non deve sapere COME la barra è strutturata.
 */
const TopbarSlotContext = createContext<HTMLDivElement | null>(null);

export function TopbarSlotProvider({ slotEl, children }: { slotEl: HTMLDivElement | null; children: ReactNode }) {
  return <TopbarSlotContext.Provider value={slotEl}>{children}</TopbarSlotContext.Provider>;
}

/**
 * Fa il portal di `children` nello slot, se già montato. Nessun fallback inline: ogni consumatore
 * (oggi solo ClienteHeader.tsx) vive comunque sempre dentro DashboardShell — nessuna rotta pubblica
 * lo usa — quindi lo slot è garantito raggiungibile. Il breve istante prima che il ref di
 * DashboardShell si agganci (slotEl ancora null) risolve da solo al render successivo, prima che
 * il browser dipinga — nessuno sfarfallio percepibile in pratica.
 */
export function TopbarPortal({ children }: { children: ReactNode }) {
  const slotEl = useContext(TopbarSlotContext);
  if (!slotEl) return null;
  return createPortal(children, slotEl);
}
