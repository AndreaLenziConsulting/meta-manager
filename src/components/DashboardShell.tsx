"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import type { Ruolo } from "@/types/kpi";

type ClienteOption = { clienteId: string; nome: string };

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
  clienti,
  ruolo,
  children,
}: {
  clienti: ClienteOption[];
  ruolo: Ruolo;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(sottoscriviCompresso, leggiCompresso, snapshotServerCompresso);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [pathnamePrecedente, setPathnamePrecedente] = useState(pathname);
  if (pathname !== pathnamePrecedente) {
    setPathnamePrecedente(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  function toggleCollapsed() {
    scriviCompresso(!collapsed);
  }

  const match = pathname.match(/^\/dashboard\/cliente\/([^/]+)/);
  const clienteAttuale = match ? decodeURIComponent(match[1]) : "";

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        ruolo={ruolo}
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 h-14 flex items-center justify-between gap-3 bg-surface-card border-b border-ink-300/60 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-ink-700 hover:text-brand transition cursor-pointer"
            aria-label="Apri menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          {clienti.length > 0 && (
            <ClientSwitcher
              clienti={clienti}
              value={clienteAttuale}
              placeholder="Seleziona cliente"
              onChange={(id) => router.push(`/dashboard/cliente/${encodeURIComponent(id)}`)}
            />
          )}
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
