"use client";

import { useState } from "react";
import { calcolaCalcolatoreBudget, calcolaPianoAnnualeBudget } from "@/lib/roiSimulatore";
import { formatEuro, formatNumero, formatRoas } from "@/lib/format";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { CalcolatoreBudgetInput } from "@/types/prospect";

function inputVuoto(): CalcolatoreBudgetInput {
  return {
    fatturatoMensile: null,
    ticketMedio: null,
    margine: null,
    cpl: null,
    tassoAppuntamento: null,
    tassoChiusura: null,
    variazioneStagionale: null,
  };
}

function haValori(v: CalcolatoreBudgetInput): boolean {
  return Object.values(v).some((x) => x !== null);
}

// Una cifra decimale per "appuntamenti a settimana" (es. "4,6"): un intero sarebbe fuorviante,
// zero decimali è troppo poco preciso per un numero già piccolo — stessa idea di formatNumero ma
// con un decimale, non vale la pena promuoverla a src/lib/format.ts per un solo utilizzo qui.
function formatUnaDecimale(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/**
 * Calcolatore Budget del Report Commerciale — sostituisce (11/2026) i 2 scenari ScenarioRoi
 * affiancati con un unico calcolo "al contrario": il commerciale imposta un fatturato mensile
 * obiettivo (+ ticket medio, margine, CPL, tassi di conversione attesi, variazione stagionale) e lo
 * strumento deriva quante vendite/appuntamenti/lead servono e quale budget media serve a sua volta
 * — vedi src/lib/roiSimulatore.ts (calcolaCalcolatoreBudget/calcolaPianoAnnualeBudget). Ogni input
 * aggiorna live sia il riepilogo mensile sia il piano annuale stagionato, nessuna chiamata di rete.
 * Adattamento al design ALC esistente (Field/Input, colori ink-* e brand) di un mockup del collega
 * che usava stili inline, slider e font propri — la logica di calcolo/stagionalità è la sua.
 */
export function SimulatoreRoi({
  value,
  onChange,
  editable,
}: {
  value: CalcolatoreBudgetInput | null;
  onChange: (value: CalcolatoreBudgetInput) => void;
  editable: boolean;
}) {
  const [vista, setVista] = useState<"mensile" | "annuale">("mensile");
  const v = value ?? inputVuoto();

  if (!editable && !haValori(v)) return null;

  const output = calcolaCalcolatoreBudget(v);
  const set = (patch: Partial<CalcolatoreBudgetInput>) => onChange({ ...v, ...patch });
  const numOrNull = (s: string) => (s === "" ? null : Number(s));

  return (
    <div className="mt-3 space-y-4">
      {editable && (
        <div className="rounded-xl border border-ink-300 bg-surface-card p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Field label="Fatturato mensile obiettivo (€)">
              <Input type="number" value={v.fatturatoMensile ?? ""} onChange={(e) => set({ fatturatoMensile: numOrNull(e.target.value) })} />
            </Field>
            <Field label="Ticket medio (€)">
              <Input type="number" value={v.ticketMedio ?? ""} onChange={(e) => set({ ticketMedio: numOrNull(e.target.value) })} />
            </Field>
            <Field label="Margine (%)">
              <Input type="number" value={v.margine ?? ""} onChange={(e) => set({ margine: numOrNull(e.target.value) })} />
            </Field>
            <Field label="CPL atteso (€)">
              <Input type="number" step="0.01" value={v.cpl ?? ""} onChange={(e) => set({ cpl: numOrNull(e.target.value) })} />
            </Field>
            <Field label="% lead → appuntamento">
              <Input type="number" value={v.tassoAppuntamento ?? ""} onChange={(e) => set({ tassoAppuntamento: numOrNull(e.target.value) })} />
            </Field>
            <Field label="% appuntamento → vendita">
              <Input type="number" value={v.tassoChiusura ?? ""} onChange={(e) => set({ tassoChiusura: numOrNull(e.target.value) })} />
            </Field>
            <Field label="Variazione stagionale (%)" hint="0 = costante, 50 = curva piena" className="col-span-2">
              <Input type="number" min={0} max={50} value={v.variazioneStagionale ?? ""} onChange={(e) => set({ variazioneStagionale: numOrNull(e.target.value) })} />
            </Field>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard label="Budget necessario / mese" value={formatEuro(output.budgetMensile)} highlight />
        <KpiCard
          label="Appuntamenti necessari / mese"
          value={formatNumero(output.numeroAppuntamenti)}
          sub={output.appuntamentiSettimana !== null ? `${formatUnaDecimale(output.appuntamentiSettimana)} a settimana` : undefined}
          highlight
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <KpiCard label="Lead necessari" value={formatNumero(output.numeroLead)} />
        <KpiCard label="Vendite necessarie" value={formatNumero(output.numeroVendite)} />
        <KpiCard label="Costo per appuntamento" value={formatEuro(output.costoPerAppuntamento)} />
        <KpiCard label="ROAS" value={formatRoas(output.roas)} />
      </div>
      {output.margineMensile !== null && (
        <p className="text-xs text-ink-500">Margine mensile atteso: <span className="font-semibold text-ink-900">{formatEuro(output.margineMensile)}</span></p>
      )}

      <div className="flex gap-1 rounded-lg bg-ink-100 p-1 w-fit">
        <TabButton active={vista === "mensile"} onClick={() => setVista("mensile")}>
          Mensile
        </TabButton>
        <TabButton active={vista === "annuale"} onClick={() => setVista("annuale")}>
          Piano annuale
        </TabButton>
      </div>

      {vista === "annuale" && <PianoAnnualeTable input={v} />}
    </div>
  );
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-xl bg-brand-light px-4 py-3" : "rounded-xl border border-ink-300/60 bg-surface-card px-3 py-2.5"}>
      <p className={highlight ? "text-[10px] uppercase tracking-widest font-semibold text-brand" : "text-[10px] uppercase tracking-wide text-ink-500"}>{label}</p>
      <p className={highlight ? "mt-1 text-lg font-heading font-bold text-ink-900 tabular-nums" : "mt-1 text-sm font-semibold text-ink-900 tabular-nums"}>{value}</p>
      {sub && <p className="text-[11px] text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-card text-brand shadow-sm"
          : "px-3 py-1.5 rounded-md text-xs font-medium text-ink-500 hover:text-ink-700"
      }
    >
      {children}
    </button>
  );
}

function PianoAnnualeTable({ input }: { input: CalcolatoreBudgetInput }) {
  const piano = calcolaPianoAnnualeBudget(input);

  if (piano.length === 0) {
    return <p className="text-xs text-ink-500">Compila fatturato obiettivo, ticket medio e i tassi di conversione per vedere il piano annuale.</p>;
  }

  const totaleAppuntamenti = piano.reduce((s, m) => s + m.appuntamenti, 0);
  const totaleVendite = piano.reduce((s, m) => s + m.vendite, 0);
  const totaleBudget = piano.reduce((s, m) => s + m.budget, 0);
  const totaleMargine = piano.reduce((s, m) => s + m.margine, 0);
  const fatturatoAnnuo = piano[piano.length - 1].fatturatoProgressivo;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[560px]">
        <thead>
          <tr className="border-b border-ink-300/60">
            <th className="text-left font-medium px-2 py-2 text-ink-500">Mese</th>
            <th className="text-right font-medium px-2 py-2 text-ink-500">Appuntamenti</th>
            <th className="text-right font-medium px-2 py-2 text-ink-500">App./sett.</th>
            <th className="text-right font-medium px-2 py-2 text-ink-500">Vendite</th>
            <th className="text-right font-medium px-2 py-2 text-ink-500">Budget</th>
            <th className="text-right font-medium px-2 py-2 text-ink-500">Margine</th>
            <th className="text-right font-medium px-2 py-2 text-ink-500">Fatt. prog.</th>
          </tr>
        </thead>
        <tbody>
          {piano.map((m) => (
            <tr key={m.mese} className="border-b border-ink-300/40 last:border-b-0">
              <td className="px-2 py-2 font-semibold text-ink-900">{m.mese}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-brand">{formatNumero(m.appuntamenti)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-700">{formatUnaDecimale(m.appuntamentiSettimana)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-700">{formatNumero(m.vendite)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-700">{formatEuro(m.budget)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-700">{formatEuro(m.margine)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink-900">{formatEuro(m.fatturatoProgressivo)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-brand-light">
            <td className="px-2 py-2.5 font-semibold text-brand">Totale anno</td>
            <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-brand">{formatNumero(totaleAppuntamenti)}</td>
            <td className="px-2 py-2.5 text-right text-ink-400">—</td>
            <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink-900">{formatNumero(totaleVendite)}</td>
            <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink-900">{formatEuro(totaleBudget)}</td>
            <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink-900">{formatEuro(totaleMargine)}</td>
            <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-brand">{formatEuro(fatturatoAnnuo)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
