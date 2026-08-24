"use client";

import { calcolaScenarioRoi } from "@/lib/roiSimulatore";
import { formatEuro, formatNumero, formatRoas } from "@/lib/format";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ScenarioRoi } from "@/types/prospect";

function scenarioVuoto(nome: string): ScenarioRoi {
  return { nome, budgetMensile: null, cpl: null, tassoAppuntamento: null, tassoChiusura: null, valoreMedioVendita: null };
}

function haValori(s: ScenarioRoi): boolean {
  return s.budgetMensile !== null || s.cpl !== null || s.tassoAppuntamento !== null || s.tassoChiusura !== null || s.valoreMedioVendita !== null;
}

/**
 * I 2 scenari a confronto della Simulazione ROI — mai estratti dalla chiamata (vedi
 * ReportCommercialeView.tsx), sempre compilati a mano qui. Ogni input aggiorna live gli output
 * calcolati (src/lib/roiSimulatore.ts) e la tabella comparativa in fondo, nessuna chiamata di rete.
 */
export function SimulatoreRoi({
  scenarioA,
  scenarioB,
  onChange,
  editable,
}: {
  scenarioA: ScenarioRoi | null;
  scenarioB: ScenarioRoi | null;
  onChange: (scenarioA: ScenarioRoi, scenarioB: ScenarioRoi) => void;
  editable: boolean;
}) {
  const a = scenarioA ?? scenarioVuoto("Scenario conservativo");
  const b = scenarioB ?? scenarioVuoto("Scenario ottimistico");

  if (!editable && !haValori(a) && !haValori(b)) return null;

  const outputA = calcolaScenarioRoi(a);
  const outputB = calcolaScenarioRoi(b);

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ScenarioPanel scenario={a} fallbackNome="Scenario conservativo" onChange={(s) => onChange(s, b)} editable={editable} />
        <ScenarioPanel scenario={b} fallbackNome="Scenario ottimistico" onChange={(s) => onChange(a, s)} editable={editable} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[420px]">
          <thead>
            <tr className="border-b border-ink-300/60">
              <th className="text-left font-medium px-2 py-2 text-ink-500" />
              <th className="text-right font-medium px-2 py-2 text-ink-500 truncate max-w-[140px]">{a.nome || "Scenario A"}</th>
              <th className="text-right font-medium px-2 py-2 text-ink-500 truncate max-w-[140px]">{b.nome || "Scenario B"}</th>
            </tr>
          </thead>
          <tbody>
            <RigaConfronto label="CPL" va={formatEuro(a.cpl)} vb={formatEuro(b.cpl)} />
            <RigaConfronto label="CPA" va={formatEuro(outputA.cpa)} vb={formatEuro(outputB.cpa)} />
            <RigaConfronto label="ROAS" va={formatRoas(outputA.roas)} vb={formatRoas(outputB.roas)} />
            <RigaConfronto label="Fatturato atteso" va={formatEuro(outputA.fatturatoAtteso)} vb={formatEuro(outputB.fatturatoAtteso)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScenarioPanel({
  scenario,
  fallbackNome,
  onChange,
  editable,
}: {
  scenario: ScenarioRoi;
  fallbackNome: string;
  onChange: (s: ScenarioRoi) => void;
  editable: boolean;
}) {
  const output = calcolaScenarioRoi(scenario);
  const set = (patch: Partial<ScenarioRoi>) => onChange({ ...scenario, ...patch });
  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="rounded-xl border border-ink-300 bg-surface-card p-4 space-y-3">
      {editable ? (
        <input
          type="text"
          value={scenario.nome}
          onChange={(e) => set({ nome: e.target.value })}
          placeholder={fallbackNome}
          className="font-heading font-bold text-ink-900 text-sm bg-transparent outline-none border-b border-transparent hover:border-ink-300 focus:border-brand w-full pb-1"
        />
      ) : (
        <p className="font-heading font-bold text-ink-900 text-sm">{scenario.nome || fallbackNome}</p>
      )}

      {editable && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Budget mensile (€)">
            <Input type="number" value={scenario.budgetMensile ?? ""} onChange={(e) => set({ budgetMensile: numOrNull(e.target.value) })} />
          </Field>
          <Field label="CPL atteso (€)">
            <Input type="number" step="0.01" value={scenario.cpl ?? ""} onChange={(e) => set({ cpl: numOrNull(e.target.value) })} />
          </Field>
          <Field label="% lead → appuntamento">
            <Input type="number" value={scenario.tassoAppuntamento ?? ""} onChange={(e) => set({ tassoAppuntamento: numOrNull(e.target.value) })} />
          </Field>
          <Field label="% appuntamento → vendita">
            <Input type="number" value={scenario.tassoChiusura ?? ""} onChange={(e) => set({ tassoChiusura: numOrNull(e.target.value) })} />
          </Field>
          <Field label="Valore medio vendita (€)" className="col-span-2">
            <Input type="number" value={scenario.valoreMedioVendita ?? ""} onChange={(e) => set({ valoreMedioVendita: numOrNull(e.target.value) })} />
          </Field>
        </div>
      )}

      <div className="pt-3 border-t border-ink-300/60 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <OutputRow label="Lead" value={formatNumero(output.numeroLead)} />
        <OutputRow label="Appuntamenti" value={formatNumero(output.numeroAppuntamenti)} />
        <OutputRow label="Vendite" value={formatNumero(output.numeroVendite)} />
        <OutputRow label="CPA" value={formatEuro(output.cpa)} />
        <OutputRow label="Fatturato" value={formatEuro(output.fatturatoAtteso)} />
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

function RigaConfronto({ label, va, vb }: { label: string; va: string; vb: string }) {
  return (
    <tr className="border-b border-ink-300/40 last:border-b-0">
      <td className="px-2 py-2 text-ink-700 font-medium">{label}</td>
      <td className="px-2 py-2 text-right tabular-nums text-ink-900">{va}</td>
      <td className="px-2 py-2 text-right tabular-nums text-ink-900">{vb}</td>
    </tr>
  );
}
