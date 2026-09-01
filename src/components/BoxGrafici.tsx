"use client";

import { useEffect, useRef, useState } from "react";
import { FunnelConversioneChart } from "@/components/FunnelConversioneChart";
import { CostoPerRisultatoChart } from "@/components/CostoPerRisultatoChart";
import { SaldoNettoCumulatoChart } from "@/components/SaldoNettoCumulatoChart";
import { AndamentoAppuntamentiChart } from "@/components/AndamentoAppuntamentiChart";

type TipoGrafico = "funnel" | "costoPerRisultato" | "saldoNetto" | "andamentoAppuntamenti";

const OPZIONI: { id: TipoGrafico; label: string; descrizione: string }[] = [
  { id: "funnel", label: "Funnel di conversione", descrizione: "Lead → appuntamenti fissati → effettuati → vendite" },
  { id: "costoPerRisultato", label: "Costo per Risultato", descrizione: "Spesa, costo/appuntamento e CAC per settimana" },
  { id: "saldoNetto", label: "Saldo netto cumulato", descrizione: "Fatturato meno investimento, da sempre" },
  { id: "andamentoAppuntamenti", label: "Andamento appuntamenti", descrizione: "Fissati vs effettuati per settimana" },
];

type SerieSettimanaleOverlay = {
  settimana: string;
  investimento: number;
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
  serieSaldoNetto,
}: {
  funnel: { numeroLead: number; appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number };
  trendSettimanaleConOverlay: SerieSettimanaleOverlay[];
  // null finché il fetch dedicato (da primaData della sede) non è arrivato — vedi KpiSection.tsx.
  serieSaldoNetto: { settimana: string; investimento: number; fatturato: number | null }[] | null;
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
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand" />
          <h3 className="font-heading font-bold text-ink-900 text-[15px]">{attivo.label}</h3>
        </div>

        <div className="relative" ref={rootRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-ink-300 bg-surface-card px-3 py-2 text-sm text-ink-900 shadow-sm hover:border-brand/40 transition cursor-pointer"
          >
            <GraficoIcon />
            {attivo.label}
            <ChevronIcon />
          </button>

          {open && (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-ink-300 bg-surface-card shadow-lg p-2">
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
      {selezionato === "saldoNetto" &&
        (serieSaldoNetto ? <SaldoNettoCumulatoChart serieDaSempre={serieSaldoNetto} /> : <p className="text-sm text-ink-500">Caricamento…</p>)}
    </div>
  );
}

function GraficoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-6 4 3 5-8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink-500">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
