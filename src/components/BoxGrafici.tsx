"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { FunnelConversioneChart } from "@/components/FunnelConversioneChart";
import { CostoPerRisultatoChart } from "@/components/CostoPerRisultatoChart";
import { SaldoNettoCumulatoChart } from "@/components/SaldoNettoCumulatoChart";
import { AndamentoAppuntamentiChart } from "@/components/AndamentoAppuntamentiChart";

type TipoGrafico = "funnel" | "costoPerRisultato" | "saldoNetto" | "andamentoAppuntamenti";

const OPZIONI: { id: TipoGrafico; label: string; descrizione: string }[] = [
  { id: "funnel", label: "Funnel di conversione", descrizione: "Lead → appuntamenti fissati → effettuati → vendite" },
  { id: "costoPerRisultato", label: "Costo per Risultato", descrizione: "Spesa, costo/lead, costo/appuntamento e CAC per settimana" },
  { id: "saldoNetto", label: "Saldo netto cumulato", descrizione: "Contrattualizzato meno investimento, nel periodo selezionato" },
  { id: "andamentoAppuntamenti", label: "Andamento appuntamenti", descrizione: "Fissati vs effettuati per settimana" },
];

type SerieSettimanaleOverlay = {
  settimana: string;
  investimento: number;
  fatturato: number | null;
  numeroLead: number;
  appuntamentiFissati: number | null;
  appuntamentiEffettuati: number | null;
  numeroVendite: number | null;
};

/**
 * Blocco 6 del redesign KPI — un solo riquadro, un menù a tendina vero (non pillole tab, scelta
 * esplicita di design del blocco 6) per scegliere quale dei 4 grafici mostrare alla volta. Stesso
 * pattern open/close/click-fuori già scritto in CampagneFilter.tsx, non reinventato qui.
 */
export function BoxGrafici({
  funnel,
  trendSettimanaleConOverlay,
}: {
  funnel: { numeroLead: number; appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number };
  trendSettimanaleConOverlay: SerieSettimanaleOverlay[];
}) {
  const [selezionato, setSelezionato] = useState<TipoGrafico>("funnel");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const attivo = OPZIONI.find((o) => o.id === selezionato)!;

  return (
    <div className="rounded-[20px] border border-[var(--glass-border-soft)] bg-surface-card shadow-[var(--shadow-panel),inset_0_1px_0_var(--glass-highlight)] p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand" />
          <h3 className="font-heading font-bold text-ink-900 text-[15px]">{attivo.label}</h3>
        </div>

        <div className="relative" ref={rootRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-[var(--glass-border-soft)] bg-surface-card backdrop-blur-lg supports-[backdrop-filter]:bg-[var(--glass-panel)] px-3 py-2 text-sm text-ink-900 shadow-sm hover:border-brand/40 transition cursor-pointer"
          >
            <LineChart size={14} className="text-ink-500" />
            {attivo.label}
            <ChevronDown size={12} className="text-ink-500" />
          </button>

          {open && (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-[var(--glass-border-soft)] bg-surface-card backdrop-blur-lg supports-[backdrop-filter]:bg-[var(--glass-panel-strong)] shadow-lg p-2">
              {OPZIONI.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setSelezionato(o.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                    o.id === selezionato ? "bg-brand-light" : "hover:bg-surface"
                  }`}
                >
                  <p className={`text-sm font-semibold ${o.id === selezionato ? "text-brand" : "text-ink-900"}`}>{o.label}</p>
                  <p className="text-[11px] text-ink-500">{o.descrizione}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selezionato === "funnel" && <FunnelConversioneChart {...funnel} />}
      {selezionato === "costoPerRisultato" && <CostoPerRisultatoChart serieSettimanale={trendSettimanaleConOverlay} />}
      {selezionato === "andamentoAppuntamenti" && <AndamentoAppuntamentiChart serieSettimanale={trendSettimanaleConOverlay} />}
      {selezionato === "saldoNetto" && <SaldoNettoCumulatoChart serieSettimanale={trendSettimanaleConOverlay} />}
    </div>
  );
}
