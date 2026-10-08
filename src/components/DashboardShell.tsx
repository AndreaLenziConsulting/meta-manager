"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import { Sidebar } from "@/components/Sidebar";
import { AccountMenu } from "@/components/AccountMenu";
import { TopbarSlotProvider } from "@/components/TopbarSlot";
import type { Ruolo } from "@/types/kpi";

const CHIAVE_COMPRESSO = "sidebar-collapsed";

// Stato compresso/espanso della rail desktop, sincronizzato con localStorage via
// useSyncExternalStore — non un useState+useEffect: leggere/scrivere localStorage in un effect
// per poi fare setState è esattamente il caso "sync con una sorgente esterna" che l'hook esiste per
// risolvere, ed evita sia l'errore di lint set-state-in-effect sia un mismatch di idratazione (sul
// server non c'è alcuna preferenza salvata: la snapshot server è sempre "espanso").
const listenerCompresso = new Set<() => void>();
function leggiCompresso(): boolean {
  return localStorage.getItem(CHIAVE_COMPRESSO) === "1";
}
function scriviCompresso(valore: boolean): void {
  localStorage.setItem(CHIAVE_COMPRESSO, valore ? "1" : "0");
  listenerCompresso.forEach((cb) => cb());
}
function sottoscriviCompresso(cb: () => void): () => void {
  listenerCompresso.add(cb);
  return () => listenerCompresso.delete(cb);
}
function snapshotServerCompresso(): boolean {
  return false;
}

/**
 * Guscio dell'area team — sostituisce TeamHeader.tsx: layout a due colonne (Sidebar + contenuto)
 * invece della vecchia barra in cima. Possiede lo stato di apertura del drawer mobile (chiuso ad
 * ogni cambio pagina, aggiustato durante il render — stesso pattern già in uso in MeetingTab.tsx
 * per "adjusting state when a prop changes", niente useEffect per questo).
 */
export function DashboardShell({
  ruolo,
  nomeAccount,
  children,
}: {
  ruolo: Ruolo;
  nomeAccount: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(sottoscriviCompresso, leggiCompresso, snapshotServerCompresso);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Nodo DOM dentro la barra sticky dove ClienteHeader.tsx porta (via TopbarSlot.tsx) torna-
  // indietro + nome cliente, per restare visibili durante lo scroll — redesign "Vetro ALC",
  // topbar unificata (09/09/2026). Vuoto (solo lo spazio) su ogni pagina senza un cliente di
  // contesto, comportamento identico a oggi.
  const [topbarSlotEl, setTopbarSlotEl] = useState<HTMLDivElement | null>(null);

  const [pathnamePrecedente, setPathnamePrecedente] = useState(pathname);
  if (pathname !== pathnamePrecedente) {
    setPathnamePrecedente(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  function toggleCollapsed() {
    scriviCompresso(!collapsed);
  }

  return (
    <TopbarSlotProvider slotEl={topbarSlotEl}>
      {/* Primo elemento raggiungibile col tasto Tab: porta dritto al contenuto, saltando il menù. */}
      <a href="#contenuto" className="salta-al-contenuto">
        Salta al contenuto
      </a>
      {/* Fondo `sfondo` pieno, come vuole il Design System ALC: card bianche con bordo e ombra sopra un
          grigio-azzurro chiaro. La tela puntinata con le sagome sfocate del redesign "vetro" è stata
          tolta il 07/10/2026 insieme alle superfici traslucide. */}
      {/* `--barra-fissa`: quanto è alta la barra che resta in alto (56px su telefono; 72px su schermo
          grande, col suo margine sopra). La legge chi deve fermarsi subito sotto: la striscia dei
          filtri del tab KPI (StrisciaFiltri.tsx). Se cambia l'altezza della barra, va cambiata qui. */}
      <div className="flex min-h-screen bg-surface [--barra-fissa:56px] lg:[--barra-fissa:72px]">
        <Sidebar
          ruolo={ruolo}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          account={<AccountMenu ruolo={ruolo} nome={nomeAccount} posizione="laterale" compatto={collapsed} />}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Barra in alto. Su telefono c'è sempre (menù, logo, account). Su schermo grande porta solo
              il contesto del cliente aperto (torna indietro, nome, modifica: vedi TopbarSlot.tsx) e
              sparisce quando è vuota — prima restava una barra bianca con dentro il solo account, che
              ora sta in fondo al menù laterale. */}
          <div className="sticky top-0 z-30 bg-surface lg:px-8 lg:pt-4 lg:has-[[data-topbar-slot]:empty]:hidden">
          <div className="flex h-14 items-center gap-2 border-b border-linea bg-surface-card px-2 lg:rounded-xl lg:border lg:px-4 lg:shadow-[var(--shadow-card)]">
            <PulsanteIcona etichetta="Apri menu" dimensione="lg" onClick={() => setMobileOpen(true)} className="order-1 text-ink-700 lg:hidden">
              <Menu size={22} aria-hidden="true" />
            </PulsanteIcona>
            {/* Slot per ClienteHeader.tsx — vedi TopbarSlot.tsx. `peer`: quando è vuoto, su telefono
                al suo posto si vede il logo. */}
            <div ref={setTopbarSlotEl} data-topbar-slot className="peer order-3 flex min-w-0 flex-1 items-center gap-3 empty:hidden" />
            <Image
              src="/lenzi.webp"
              alt="Andrea Lenzi Consulting"
              width={110}
              height={38}
              className="order-2 mr-auto hidden h-8 w-auto object-contain peer-empty:block lg:!hidden"
            />
            <div className="order-4 lg:hidden">
              <AccountMenu ruolo={ruolo} nome={nomeAccount} />
            </div>
          </div>
          </div>
          <main id="contenuto" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </div>
      </div>
    </TopbarSlotProvider>
  );
}
