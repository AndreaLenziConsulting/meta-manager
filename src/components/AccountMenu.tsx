"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/cn";
import { iniziali } from "@/lib/format";
import type { Ruolo } from "@/types/kpi";

const ETICHETTA_RUOLO: Record<Ruolo, string> = {
  admin: "Amministratore",
  consulente: "Consulente",
  commerciale: "Commerciale",
};

/**
 * Chi ha effettuato l'accesso, con un menu a tendina per uscire. Due posti:
 * - `laterale`: in fondo al menù laterale su schermo grande (il menu si apre verso l'alto);
 *   `compatto` = rail compressa, resta solo il cerchio;
 * - `barra` (default): nella barra in alto su telefono, solo il cerchio, menu verso il basso.
 */
export function AccountMenu({
  ruolo,
  nome,
  posizione = "barra",
  compatto = false,
}: {
  ruolo: Ruolo;
  nome: string | null;
  posizione?: "barra" | "laterale";
  compatto?: boolean;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [uscendo, setUscendo] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto) return;
    function chiudiSeFuori(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setAperto(false);
    }
    function chiudiConEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAperto(false);
    }
    document.addEventListener("mousedown", chiudiSeFuori);
    document.addEventListener("keydown", chiudiConEsc);
    return () => {
      document.removeEventListener("mousedown", chiudiSeFuori);
      document.removeEventListener("keydown", chiudiConEsc);
    };
  }, [aperto]);

  async function handleEsci() {
    setUscendo(true);
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const laterale = posizione === "laterale";
  const mostraNome = laterale && !compatto;
  const etichetta = nome ?? ETICHETTA_RUOLO[ruolo];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aperto}
        aria-label={mostraNome ? undefined : `Account: ${etichetta}`}
        title={mostraNome ? undefined : etichetta}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg text-left text-sm text-ink-900 transition cursor-pointer hover:bg-surface",
          laterale ? "w-full px-2" : "px-1.5"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {nome ? iniziali(nome) : <Shield size={16} aria-hidden="true" />}
        </span>
        {mostraNome && (
          <span className="min-w-0">
            <span className="block truncate font-semibold">{etichetta}</span>
            {nome && <span className="block truncate text-xs text-ink-500">{ETICHETTA_RUOLO[ruolo]}</span>}
          </span>
        )}
      </button>

      {aperto && (
        <div
          role="menu"
          className={cn(
            "absolute z-30 w-52 rounded-xl border border-linea bg-surface-card py-1.5 shadow-[var(--shadow-alta)]",
            laterale ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          )}
        >
          <div className="px-3 py-2 border-b border-linea">
            <p className="text-sm font-semibold text-ink-900 truncate">{etichetta}</p>
            {nome && <p className="text-xs text-ink-500">{ETICHETTA_RUOLO[ruolo]}</p>}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleEsci}
            disabled={uscendo}
            className="w-full flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-critico hover:bg-critico-tenue disabled:opacity-50 transition-colors cursor-pointer"
          >
            <LogOut size={16} aria-hidden="true" />
            {uscendo ? "Uscita…" : "Esci"}
          </button>
        </div>
      )}
    </div>
  );
}
