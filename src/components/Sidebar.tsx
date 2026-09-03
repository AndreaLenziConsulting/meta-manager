"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
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
    label: "Dashboard Amministratore",
    icon: LayoutDashboard,
    ruoli: ["admin"],
    attiva: (p) => p === "/dashboard" || p.startsWith("/dashboard/nuovo-cliente"),
  },
  {
    href: "/dashboard/commerciale",
    label: "Prospect",
    icon: Users,
    ruoli: ["admin", "commerciale"],
    attiva: (p) => p.startsWith("/dashboard/commerciale"),
  },
  {
    href: "/dashboard/clienti",
    label: "Clienti",
    icon: Building2,
    // Sempre visibile per il consulente anche con 0 clienti assegnati: porta comunque a una pagina
    // reale (con stato vuoto), meglio di nessuna voce di navigazione com'era prima.
    ruoli: ["admin", "consulente"],
    attiva: (p) => p.startsWith("/dashboard/clienti") || p.startsWith("/dashboard/cliente/"),
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
    href: "/dashboard/guida",
    label: "Guida",
    icon: BookOpen,
    // Macro-sezione tutorial su come usare la piattaforma — dominio trasversale (non
    // cliente/prospect), visibile a tutto il team a differenza delle voci sopra.
    ruoli: ["admin", "consulente", "commerciale"],
    attiva: (p) => p.startsWith("/dashboard/guida"),
  },
];

export function Sidebar({
  ruolo,
  pathname,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  ruolo: Ruolo;
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const voci = NAV_ITEMS.filter((v) => v.ruoli.includes(ruolo));

  function renderNav(mostraEtichette: boolean) {
    return voci.map(({ href, label, icon: Icon, attiva }) => {
      const attivaOra = attiva(pathname);
      return (
        <Link
          key={href}
          href={href}
          title={mostraEtichette ? undefined : label}
          aria-label={label}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
            attivaOra ? "bg-brand-light text-brand" : "text-ink-700 hover:bg-surface hover:text-ink-900"
          )}
        >
          <Icon size={20} className="flex-shrink-0" />
          {mostraEtichette && <span className="truncate">{label}</span>}
        </Link>
      );
    });
  }

  return (
    <>
      {/* Rail desktop — sticky così resta ferma mentre <main> scorre */}
      <aside
        className={cn(
          "hidden lg:flex flex-col sticky top-0 h-screen flex-shrink-0 border-r border-ink-300/60 bg-surface-card transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="h-16 flex items-center px-4 border-b border-ink-300/60 overflow-hidden">
          {!collapsed && (
            <Image src="/lenzi.webp" alt="Andrea Lenzi Consulting" width={110} height={38} className="object-contain h-8 w-auto" />
          )}
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">{renderNav(!collapsed)}</nav>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex items-center gap-2 px-3 py-3 m-2 rounded-xl text-ink-500 hover:text-brand hover:bg-surface transition cursor-pointer"
          aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          {!collapsed && <span className="text-sm font-semibold">Comprimi</span>}
        </button>
      </aside>

      {/* Drawer mobile — stesso pattern overlay di ui/Modal.tsx (onMouseDown+onClick stopPropagation
          sul pannello, non solo onClick: un drag che parte dentro e finisce sopra l'overlay non deve
          chiudere accidentalmente il menu). */}
      {mobileOpen && (
        <div role="presentation" onClick={onCloseMobile} className="fixed inset-0 z-50 bg-black/40 lg:hidden">
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu di navigazione"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-y-0 left-0 w-64 bg-surface-card border-r border-ink-300/60 shadow-lg flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-ink-300/60">
              <Image src="/lenzi.webp" alt="Andrea Lenzi Consulting" width={110} height={38} className="object-contain h-8 w-auto" />
              <button type="button" onClick={onCloseMobile} className="text-ink-500 hover:text-ink-900 cursor-pointer" aria-label="Chiudi menu">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-1">{renderNav(true)}</nav>
          </aside>
        </div>
      )}
    </>
  );
}
