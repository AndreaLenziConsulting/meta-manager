"use client";

import { useState } from "react";
import { calcolaScenarioRoi } from "@/lib/roiSimulatore";
import { formatEuro, formatNumero, formatRoas } from "@/lib/format";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { ScenarioRoi } from "@/types/prospect";

/**
 * Pannello previsionale per una singola sede — a differenza di SimulatoreRoi (2 scenari
 * affiancati, compilati a mano dal commerciale) qui c'è un solo scenario, pre-popolato dai dati
 * reali del periodo selezionato (scenarioDaDatiReali in src/lib/kpiPrevisionale.ts, già calcolato
 * dal chiamante e passato come `seed`) e poi liberamente modificabile per proiettare "cosa
 * succederebbe se". Ricalcolo sincrono a ogni digitazione via calcolaScenarioRoi, nessuna
 * chiamata di rete.
 */
export function PerformancePrevisionale({ seed }: { seed: ScenarioRoi }) {
  const seedKey = JSON.stringify(seed);
  const [scenario, setScenario] = useState<ScenarioRoi>(seed);
  // Riallineamento durante il render (non in un effect, per evitare il doppio render che
  // react-hooks/set-state-in-effect segnala): quando seedKey cambia rispetto all'ultimo
  // render sincronizzato, questo if aggiorna lo stato prima del commit — pattern consigliato da
  // React per "adjusting state when a prop changes" (https://react.dev/learn/you-might-not-need-an-effect).
  // Il pulsante "Riporta al punto di partenza" usa `seed` direttamente (non serve un ref: è un
  // prop, quindi ogni render dell'event handler chiude già sull'ultimo valore ricevuto).
  const [seedKeySincronizzata, setSeedKeySincronizzata] = useState(seedKey);
  if (seedKey !== seedKeySincronizzata) {
    setSeedKeySincronizzata(seedKey);
    setScenario(seed);
  }

  const output = calcolaScenarioRoi(scenario);
  const set = (patch: Partial<ScenarioRoi>) => setScenario((s) => ({ ...s, ...patch }));
  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="rounded-xl border border-ink-300 bg-surface-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading font-bold text-ink-900 text-sm">Performance previsionale</p>
        <Button variant="secondary" size="sm" onClick={() => setScenario(seed)}>
          Riporta al punto di partenza
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Budget mensile (€)">
          <Input
            type="number"
            value={scenario.budgetMensile ?? ""}
            onChange={(e) => set({ budgetMensile: numOrNull(e.target.value) })}
          />
        </Field>
        <Field label="CPL atteso (€)">
          <Input
            type="number"
            step="0.01"
            value={scenario.cpl ?? ""}
            onChange={(e) => set({ cpl: numOrNull(e.target.value) })}
          />
        </Field>
        <Field label="% contatto → appuntamento">
          <Input
            type="number"
            value={scenario.tassoAppuntamento ?? ""}
            onChange={(e) => set({ tassoAppuntamento: numOrNull(e.target.value) })}
          />
        </Field>
        <Field label="% presenza → acquisto">
          <Input
            type="number"
            value={scenario.tassoChiusura ?? ""}
            onChange={(e) => set({ tassoChiusura: numOrNull(e.target.value) })}
          />
        </Field>
        <Field label="Valore medio vendita (€)" className="col-span-2">
          <Input
            type="number"
            value={scenario.valoreMedioVendita ?? ""}
            onChange={(e) => set({ valoreMedioVendita: numOrNull(e.target.value) })}
          />
        </Field>
      </div>

      <div className="pt-3 border-t border-ink-300/60 grid grid-cols-3 gap-x-3 gap-y-2.5 text-sm">
        <OutputRow label="Lead" value={formatNumero(output.numeroLead)} />
        <OutputRow label="Appuntamenti" value={formatNumero(output.numeroAppuntamenti)} />
        <OutputRow label="Vendite" value={formatNumero(output.numeroVendite)} />
        <OutputRow label="CPA" value={formatEuro(output.cpa)} />
        <OutputRow label="Fatturato atteso" value={formatEuro(output.fatturatoAtteso)} />
        <OutputRow label="ROAS" value={formatRoas(output.roas)} />
      </div>
    </div>
  );
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
      <p className="font-semibold text-ink-900 tabular-nums">{value}</p>
    </div>
  );
}
