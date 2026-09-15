"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimulatoreRoi } from "@/components/SimulatoreRoi";
import { Button } from "@/components/ui/Button";
import type { CalcolatoreBudgetInput, Prospect } from "@/types/prospect";

/**
 * Editor del Calcolatore Budget di UN prospect — sempre modificabile (nessuna vista di sola
 * lettura: questa pagina esiste solo per compilarlo), stesso pattern "stato locale + Salva
 * modifiche" già in uso per i Dati commerciali del prospect (ProspectDatiCommerciali.tsx) invece
 * di un salvataggio a ogni tasto premuto, per non intasare l'API Sheets. `router.refresh()` dopo
 * il salvataggio così la card di riepilogo nella pagina prospect principale (che legge da
 * `prospect.calcolatoreBudget` lato server) mostra subito i nuovi numeri se l'utente torna indietro.
 */
export function CalcolatoreBudgetProspect({ prospect }: { prospect: Prospect }) {
  const router = useRouter();
  const [valore, setValore] = useState<CalcolatoreBudgetInput | null>(prospect.calcolatoreBudget);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);

  async function handleSalva() {
    setSalvando(true);
    setErrore(null);
    setSalvato(false);
    try {
      const res = await fetch("/api/prospect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.prospectId, calcolatoreBudget: valore }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setSalvato(true);
      router.refresh();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5 sm:p-6 space-y-4">
      <SimulatoreRoi value={valore} onChange={setValore} editable />

      {errore && <p className="text-xs text-red-600">{errore}</p>}

      <div className="flex items-center gap-3 pt-2 border-t border-ink-300/60">
        <Button type="button" onClick={handleSalva} disabled={salvando}>
          {salvando ? "Salvataggio…" : "Salva modifiche"}
        </Button>
        {salvato && <span className="text-xs font-medium text-green-700">Salvato</span>}
      </div>
    </div>
  );
}
