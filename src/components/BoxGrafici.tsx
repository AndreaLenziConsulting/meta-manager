"use client";

import { useState } from "react";
import { SelettoreGrafico, type OpzioneGrafico } from "@/components/SelettoreGrafico";
import { FunnelConversioneChart } from "@/components/FunnelConversioneChart";
import { CostoPerRisultatoChart } from "@/components/CostoPerRisultatoChart";
import { SaldoNettoCumulatoChart } from "@/components/SaldoNettoCumulatoChart";
import { AndamentoAppuntamentiChart } from "@/components/AndamentoAppuntamentiChart";
import { PacingTargetChart } from "@/components/PacingTargetChart";

type TipoGrafico = "pacing" | "funnel" | "costoPerRisultato" | "saldoNetto" | "andamentoAppuntamenti";

const OPZIONI_BASE: OpzioneGrafico<TipoGrafico>[] = [
  { id: "funnel", label: "Funnel di conversione", descrizione: "Lead → appuntamenti fissati → effettuati → vendite" },
  { id: "costoPerRisultato", label: "Costo per Risultato", descrizione: "Spesa, costo/lead, costo/appuntamento e CAC per settimana" },
  { id: "saldoNetto", label: "Saldo netto cumulato", descrizione: "Contrattualizzato meno investimento, nel periodo selezionato" },
  { id: "andamentoAppuntamenti", label: "Andamento appuntamenti", descrizione: "Fissati vs effettuati per settimana" },
];

const OPZIONE_PACING: OpzioneGrafico<TipoGrafico> = {
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
 * esplicita di design del blocco 6) per scegliere quale dei grafici mostrare alla volta. La tendina
 * è SelettoreGrafico.tsx, la stessa del riquadro dei venditori.
 *
 * "Target mensili" (richiesta utente, 11/2026) è l'unica opzione che riceve una prop dedicata
 * (`pacing`) invece di leggere `funnel`/`trendSettimanaleConOverlay` come le altre: guarda un mese
 * scelto al suo interno (di default quello in corso), un concetto indipendente dal periodo scelto nel filtro sopra (che qui può
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
  const attivo = OPZIONI.find((o) => o.id === selezionato) ?? OPZIONI[0];

  return (
    <div className="rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-xl leading-[26px] font-bold text-ink-900">{attivo.label}</h3>
        </div>

        <SelettoreGrafico opzioni={OPZIONI} selezionato={selezionato} onChange={setSelezionato} />
      </div>

      {selezionato === "pacing" && pacing && <PacingTargetChart {...pacing} />}
      {selezionato === "funnel" && <FunnelConversioneChart {...funnel} />}
      {selezionato === "costoPerRisultato" && <CostoPerRisultatoChart serieSettimanale={trendSettimanaleConOverlay} />}
      {selezionato === "andamentoAppuntamenti" && <AndamentoAppuntamentiChart serieSettimanale={trendSettimanaleConOverlay} />}
      {selezionato === "saldoNetto" && <SaldoNettoCumulatoChart serieSettimanale={trendSettimanaleConOverlay} />}
    </div>
  );
}
