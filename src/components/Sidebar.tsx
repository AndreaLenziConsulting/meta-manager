"use client";

import { useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CalendarClock,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import type { Ruolo } from "@/types/kpi";

/**
 * Menù di navigazione principale dell'area team — sostituisce i link in cima a TeamHeader.tsx con
 * un vero menù laterale "da software" (rail comprimibile su desktop, drawer overlay su mobile),
 * su richiesta esplicita dell'utente. Lista dati (non link sparsi nel JSX) con un predicato di
 * attivazione per voce, così l'evidenziazione della voce corrente non richiede logica ad-hoc altrove.
 */

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  ruoli: Ruolo[];
  attiva: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Clienti",
    icon: Building2,
    // Unifica le vecchie "Dashboard Amministratore" (solo admin) e "Clienti" (admin+consulente) in
    // un'unica voce — richiesta esplicita dell'utente, avere entrambe era ridondante. Sempre
    // visibile per il consulente anche con 0 clienti assegnati: porta comunque a una pagina reale
    // (con stato vuoto), meglio di nessuna voce di navigazione.
    ruoli: ["admin", "consulente"],
    attiva: (p) =>
      p === "/dashboard" ||
      p.startsWith("/dashboard/clienti") ||
      p.startsWith("/dashboard/cliente/") ||
      p.startsWith("/dashboard/nuovo-cliente"),
  },
  {
    href: "/dashboard/commerciale",
    label: "Prospect",
    icon: Users,
    ruoli: ["admin", "commerciale"],
    attiva: (p) => p.startsWith("/dashboard/commerciale"),
  },
  {
    href: "/dashboard/attivita",
    label: "Attività",
    icon: ListChecks,
    // Niente commerciale: dominio cliente/roadmap prodotto, non prospect.
    ruoli: ["admin", "consulente"],
    attiva: (p) => p.startsWith("/dashboard/attivita"),
  },
  {
    href: "/dashboard/meeting",
    label: "Meeting",
    icon: CalendarClock,
    // Niente commerciale: stesso dominio cliente/roadmap di "Attività", non prospect.
    ruoli: ["admin", "consulente"],
    attiva: (p) => p.startsWith("/dashboard/meeting"),
  },
  {
    href: "/dashboard/guida",
    label: "Guida",
    icon: BookOpen,
    // Macro-sezione tutorial su come usare la piattaforma — dominio trasversale (non
    // cliente/prospect), visibile a tutto il team a differenza delle voci sopra.
    ruoli: ["admin", "consulente", "commerciale"],
    attiva: (p) => p.startsWith("/dashboard/guida"),
  },
  {
    href: "/dashboard/impostazioni",
    label: "Impostazioni",
    icon: Settings,
    // Squadra, prodotti e modelli di attività (08/10/2026): prima si cambiavano a mano nel foglio
    // Google, poi nelle tabelle di Supabase. Solo amministratore, come la pagina.
    ruoli: ["admin"],
    attiva: (p) => p.startsWith("/dashboard/impostazioni"),
  },
];

export function Sidebar({
  ruolo,
  pathname,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  account,
}: {
  ruolo: Ruolo;
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Indicatore di chi ha fatto l'accesso, in fondo al menù su schermo grande (AccountMenu.tsx). */
  account?: ReactNode;
}) {
  const voci = NAV_ITEMS.filter((v) => v.ruoli.includes(ruolo));

  // Il cassetto su telefono è una finestra di dialogo: Esc lo chiude, come ogni modale dell'app.
  useEffect(() => {
    if (!mobileOpen) return;
    function suTasto(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseMobile();
    }
    document.addEventListener("keydown", suTasto);
    return () => document.removeEventListener("keydown", suTasto);
  }, [mobileOpen, onCloseMobile]);

  function renderNav(mostraEtichette: boolean) {
    return voci.map(({ href, label, icon: Icon, attiva }) => {
      const attivaOra = attiva(pathname);
      return (
        // Niente precaricamento (04/10/2026): ogni pagina del menù è dinamica e Next.js, senza questo,
        // la renderizzava sul server a ogni visualizzazione del menù (2 volte per voce: menù desktop e
        // mobile), leggendo il foglio Google ogni volta — contribuiva a esaurire le 60 letture al
        // minuto dell'app. La pagina si carica comunque al clic.
        <Link
          key={href}
          href={href}
          prefetch={false}
          title={mostraEtichette ? undefined : label}
          aria-label={label}
          aria-current={attivaOra ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
            attivaOra ? "bg-brand-light text-brand" : "text-ink-700 hover:bg-surface hover:text-ink-900"
          )}
        >
          <Icon size={20} className="flex-shrink-0" aria-hidden="true" />
          {mostraEtichette && <span className="truncate">{label}</span>}
        </Link>
      );
    });
  }

  return (
    <>
      {/* Rail desktop — sticky così resta ferma mentre <main> scorre. Superficie piena con bordo
          `linea` (Design System ALC). `z-20`: il menù dell'account in fondo si apre verso l'alto e,
          a rail compressa, esce dalla sua larghezza sopra il contenuto. */}
      <aside
        className={cn(
          "hidden lg:flex flex-col sticky top-0 z-20 h-screen flex-shrink-0 border-r border-linea bg-surface-card transition-[width] duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo disteso sull'intera larghezza del blocco (richiesta utente, 09/2026), non più una
            piccola immagine con largo margine intorno — solo px-3 di respiro dai bordi, w-full così
            scala insieme alla rail invece di restare a dimensione fissa. */}
        <div className="h-16 flex items-center px-3 border-b border-linea overflow-hidden">
          {!collapsed && (
            <Image src="/lenzi.webp" alt="Andrea Lenzi Consulting" width={220} height={56} className="object-contain w-full h-auto" />
          )}
        </div>
        <nav aria-label="Sezioni" className="flex-1 px-2 py-4 space-y-1">
          {renderNav(!collapsed)}
        </nav>
        {account && <div className="px-2 pb-1">{account}</div>}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex min-h-11 items-center gap-3 px-3 m-2 mt-1 rounded-lg text-ink-500 hover:text-brand hover:bg-surface transition cursor-pointer"
          aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
        >
          {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          {!collapsed && <span className="text-sm font-semibold">Comprimi</span>}
        </button>
      </aside>

      {/* Drawer mobile — stesso pattern overlay di ui/Modal.tsx (onMouseDown+onClick stopPropagation
          sul pannello, non solo onClick: un drag che parte dentro e finisce sopra l'overlay non deve
          chiudere accidentalmente il menu). */}
      {mobileOpen && (
        <div role="presentation" onClick={onCloseMobile} className="fixed inset-0 z-50 bg-notte/50 lg:hidden">
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu di navigazione"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-y-0 left-0 w-64 bg-surface-card border-r border-linea shadow-lg flex flex-col"
          >
            <div className="h-16 flex items-center justify-between pl-4 pr-2 border-b border-linea">
              <Image src="/lenzi.webp" alt="Andrea Lenzi Consulting" width={110} height={38} className="object-contain h-8 w-auto" />
              <PulsanteIcona etichetta="Chiudi menu" dimensione="lg" onClick={onCloseMobile} autoFocus>
                <X size={20} aria-hidden="true" />
              </PulsanteIcona>
            </div>
            <nav aria-label="Sezioni" className="flex-1 px-2 py-4 space-y-1">
              {renderNav(true)}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
