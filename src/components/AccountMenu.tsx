"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { iniziali } from "@/lib/format";
import type { Ruolo } from "@/types/kpi";

const ETICHETTA_RUOLO: Record<Ruolo, string> = {
  admin: "Amministratore",
  consulente: "Consulente",
  commerciale: "Commerciale",
};

/**
 * Sostituisce ClientSwitcher.tsx nella barra in alto (l'utente lo trovava poco utile ormai che la
 * navigazione clienti vive nella Sidebar/pagina Clienti) — mostra invece chi ha effettuato
 * l'accesso, con un menu a tendina per uscire. Nessun logout esisteva prima in tutta l'app: questo
 * è anche il primo punto in cui diventa possibile, non solo un indicatore statico.
 */
export function AccountMenu({ ruolo, nome }: { ruolo: Ruolo; nome: string | null }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [uscendo, setUscendo] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto) return;
    function chiudiSeFuori(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setAperto(false);
    }
    document.addEventListener("mousedown", chiudiSeFuori);
    return () => document.removeEventListener("mousedown", chiudiSeFuori);
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

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-ink-300 bg-surface-card px-2.5 py-1.5 text-sm text-ink-900 shadow-sm hover:border-brand/40 transition cursor-pointer"
      >
        {nome ? (
          <span className="w-6 h-6 rounded-full bg-brand text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
            {iniziali(nome)}
          </span>
        ) : (
          <Shield size={16} className="text-brand flex-shrink-0" />
        )}
        <span className="hidden sm:inline font-medium truncate max-w-[140px]">{nome ?? ETICHETTA_RUOLO[ruolo]}</span>
      </button>

      {aperto && (
        <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl border border-ink-300 bg-surface-card shadow-lg py-1.5">
          <div className="px-3 py-2 border-b border-ink-300/60">
            <p className="text-sm font-semibold text-ink-900 truncate">{nome ?? ETICHETTA_RUOLO[ruolo]}</p>
            {nome && <p className="text-xs text-ink-500">{ETICHETTA_RUOLO[ruolo]}</p>}
          </div>
          <button
            type="button"
            onClick={handleEsci}
            disabled={uscendo}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            {uscendo ? "Uscita…" : "Esci"}
          </button>
        </div>
      )}
    </div>
  );
}
