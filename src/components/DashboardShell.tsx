"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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
      {/* Tela di sfondo "Vetro ALC": colore superficie + pallinato sottile (stesso trattamento del
          mockup di riferimento), su QUESTO contenitore — non su body globale, per non toccare
          login/report pubblico. La riga sotto (Sidebar + colonna contenuto) è apposta TRASPARENTE:
          prima aveva un suo `bg-surface` opaco che copriva per intero le sagome sfocate qui sotto,
          rendendole invisibili — bug corretto qui (10/09/2026, "il live non somiglia al mockup"). */}
      <div className="relative min-h-screen bg-surface bg-[radial-gradient(var(--grid-dot)_1px,transparent_1px)] [background-size:24px_24px]">
        {/* Due sagome sfocate NEUTRE (ink-300, mai un colore di brand) danno il rilievo che serve
            al backdrop-filter di Sidebar/barra sticky per leggersi, più un accenno discreto di blu
            che firma la pagina senza dominarla. `fixed` (non `absolute`): resta ancorato al
            viewport a prescindere dagli antenati `sticky`/overflow del guscio, e non contribuisce
            mai allo scroll orizzontale della pagina. */}
        <div className="pointer-events-none fixed -z-10 rounded-full bg-ink-300 opacity-90 blur-[100px] w-[820px] h-[820px] -top-[360px] -right-[260px]" />
        <div className="pointer-events-none fixed -z-10 rounded-full bg-ink-300 opacity-80 blur-[100px] w-[640px] h-[640px] -bottom-[300px] -left-[200px]" />
        <div className="pointer-events-none fixed -z-10 rounded-full bg-brand opacity-[0.16] blur-[100px] w-[460px] h-[460px] -top-[180px] left-[22%]" />

        <div className="flex min-h-screen">
          <Sidebar
            ruolo={ruolo}
            pathname={pathname}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="sticky top-0 z-10 h-14 flex items-center justify-between gap-3 bg-surface-card border-b border-[var(--glass-border-soft)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[var(--glass-chrome-strong)] px-6 sm:px-8">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden text-ink-700 hover:text-brand transition cursor-pointer"
                aria-label="Apri menu"
              >
                <Menu size={22} />
              </button>
              {/* Slot per ClienteHeader.tsx (torna-indietro + nome cliente) — vedi TopbarSlot.tsx. */}
              <div ref={setTopbarSlotEl} className="flex-1 min-w-0 flex items-center gap-3" />
              <AccountMenu ruolo={ruolo} nome={nomeAccount} />
            </div>
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </div>
    </TopbarSlotProvider>
  );
}
