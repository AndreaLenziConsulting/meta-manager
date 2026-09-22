"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { FunnelConversioneChart } from "@/components/FunnelConversioneChart";
import { CostoPerRisultatoChart } from "@/components/CostoPerRisultatoChart";
import { SaldoNettoCumulatoChart } from "@/components/SaldoNettoCumulatoChart";
import { AndamentoAppuntamentiChart } from "@/components/AndamentoAppuntamentiChart";
import { PacingTargetChart } from "@/components/PacingTargetChart";

type TipoGrafico = "pacing" | "funnel" | "costoPerRisultato" | "saldoNetto" | "andamentoAppuntamenti";

const OPZIONI_BASE: { id: TipoGrafico; label: string; descrizione: string }[] = [
  { id: "funnel", label: "Funnel di conversione", descrizione: "Lead → appuntamenti fissati → effettuati → vendite" },
  { id: "costoPerRisultato", label: "Costo per Risultato", descrizione: "Spesa, costo/lead, costo/appuntamento e CAC per settimana" },
  { id: "saldoNetto", label: "Saldo netto cumulato", descrizione: "Contrattualizzato meno investimento, nel periodo selezionato" },
  { id: "andamentoAppuntamenti", label: "Andamento appuntamenti", descrizione: "Fissati vs effettuati per settimana" },
];

const OPZIONE_PACING: { id: TipoGrafico; label: string; descrizione: string } = {
  id: "pacing",
  label: "Target mensili",
  descrizione: "Ritmo di spesa/fatturato/lead/appuntamenti rispetto a oggi",
};

type PropsPacing = {
  clienteId: string;
  sedeId: string;
  haConnessioneGhl: boolean;
  targetBudgetMensile: number | null;
  targetFatturatoMensile: number | null;
  targetLeadSettimana: number | null;
  targetAppuntamentiSettimana: number | null;
};

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
 * esplicita di design del blocco 6) per scegliere quale dei grafici mostrare alla volta. Stesso
 * pattern open/close/click-fuori già scritto in CampagneFilter.tsx, non reinventato qui.
 *
 * "Target mensili" (richiesta utente, 11/2026) è l'unica opzione che riceve una prop dedicata
 * (`pacing`) invece di leggere `funnel`/`trendSettimanaleConOverlay` come le altre: guarda SEMPRE
 * il mese in corso, un concetto indipendente dal periodo scelto nel filtro sopra (che qui può
 * essere un mese passato o un intervallo di più mesi) — vedi PacingTargetChart.tsx, che fa il
 * proprio fetch invece di derivare dai dati già scaricati per il periodo selezionato. Assente
 * (`pacing` non passata) sul link pubblico cliente `code`, stesso motivo per cui i target non sono
 * mai esposti lì (vedi /api/kpi route.ts, campo `internal`) — l'opzione compare in tendina solo
 * quando `pacing` è presente.
 *
 * Default (richiesta utente, 22/09/2026): "Target mensili" solo se `pacingHaTarget` è vero, cioè la
 * sede o almeno una delle sue categorie commerciali ha un target impostato (altrimenti
 * PacingTargetChart mostrerebbe solo il messaggio "nessun target impostato" — un default vuoto non
 * è utile) — calcolato dal chiamante (KpiSection.tsx, che ha già dati.sede.categorie in memoria),
 * non qui: `pacing` porta solo i 4 campi sede che servono a PacingTargetChart, non basterebbero da
 * soli a decidere il default per un cliente con target solo a livello di categoria. Se `pacing` è
 * presente ma `pacingHaTarget` è falso, il default è "Costo per Risultato" invece del vecchio
 * "Target mensili" incondizionato. Sul link pubblico (`pacing` assente, nessun concetto di target
 * lì) il default resta "Funnel di conversione", invariato.
 *
 * "Performance venditori" (Fase 2/4) NON è più qui (richiesta utente 20/09/2026: "va nella sezione
 * Andamento commerciale, non tra i grafici") — vedi AndamentoCommerciale.tsx sotto KpiSection.tsx,
 * un blocco a parte invece di una quarta opzione in questa stessa tendina.
 */
export function BoxGrafici({
  funnel,
  trendSettimanaleConOverlay,
  pacing,
  pacingHaTarget,
}: {
  funnel: { numeroLead: number; appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number };
  trendSettimanaleConOverlay: SerieSettimanaleOverlay[];
  pacing?: PropsPacing;
  // Vero se la sede (o una sua categoria) ha un target mensile/settimanale impostato — decide SOLO
  // il default iniziale della tendina, vedi il commento sopra. Calcolato dal chiamante perché
  // include dati.sede.categorie, che `pacing` non porta.
  pacingHaTarget?: boolean;
}) {
  const OPZIONI = [...(pacing ? [OPZIONE_PACING] : []), ...OPZIONI_BASE];
  const [selezionato, setSelezionato] = useState<TipoGrafico>(
    !pacing ? "funnel" : pacingHaTarget ? "pacing" : "costoPerRisultato"
  );
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

  const attivo = OPZIONI.find((o) => o.id === selezionato) ?? OPZIONI[0];

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

      {selezionato === "pacing" && pacing && <PacingTargetChart {...pacing} />}
      {selezionato === "funnel" && <FunnelConversioneChart {...funnel} />}
      {selezionato === "costoPerRisultato" && <CostoPerRisultatoChart serieSettimanale={trendSettimanaleConOverlay} />}
      {selezionato === "andamentoAppuntamenti" && <AndamentoAppuntamentiChart serieSettimanale={trendSettimanaleConOverlay} />}
      {selezionato === "saldoNetto" && <SaldoNettoCumulatoChart serieSettimanale={trendSettimanaleConOverlay} />}
    </div>
  );
}
