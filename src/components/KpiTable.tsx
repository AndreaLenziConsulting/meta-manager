"use client";

import { useMemo, useState } from "react";
import type { KpiGroup, RigaCampagna } from "@/types/kpi";
import { formatDataBreve, formatEuro, formatNumero, formatPercentuale, formatRoas, formatStatoCampagna } from "@/lib/format";
import { Tabs } from "@/components/Tabs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const COLONNE_TIPO: { key: keyof KpiGroup; label: string; format: (v: number | null) => string }[] = [
  { key: "investimento", label: "Investimento", format: formatEuro },
  { key: "numeroLead", label: "Lead", format: formatNumero },
  { key: "costoPerLead", label: "Costo/Lead", format: formatEuro },
  { key: "numeroRichieste", label: "Richieste", format: formatNumero },
  { key: "costoPerRichiesta", label: "Costo/Richiesta", format: formatEuro },
  { key: "appuntamentiFissati", label: "App. fissati", format: formatNumero },
  { key: "appuntamentiEffettuati", label: "App. effettuati", format: formatNumero },
  { key: "percentualeEffettuatiSuFissati", label: "% effettuati", format: formatPercentuale },
  { key: "costoPerAppuntamentoEffettuato", label: "Costo/App. effettuato", format: formatEuro },
  { key: "numeroVendite", label: "Vendite", format: formatNumero },
  { key: "tassoDiChiusura", label: "Tasso chiusura", format: formatPercentuale },
  { key: "fatturato", label: "Fatturato", format: formatEuro },
  { key: "roas", label: "ROAS", format: formatRoas },
  { key: "cpa", label: "CPA", format: formatEuro },
];

const VISTA_TABS = [
  { id: "tipo", label: "Per tipo campagna" },
  { id: "campagna", label: "Per singola campagna" },
];

export function KpiTable({ gruppi, totale, campagne }: { gruppi: KpiGroup[]; totale: KpiGroup; campagne: RigaCampagna[] }) {
  const [vista, setVista] = useState<"tipo" | "campagna">("tipo");

  const totaleCampagne = useMemo(() => {
    const investimento = campagne.reduce((s, c) => s + c.investimento, 0);
    const numeroLead = campagne.reduce((s, c) => s + c.numeroLead, 0);
    return { investimento, numeroLead, costoPerLead: numeroLead ? investimento / numeroLead : null };
  }, [campagne]);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand" />
          <h3 className="font-heading font-bold text-ink-900 text-[15px]">Dettaglio</h3>
        </div>
        <Tabs tabs={VISTA_TABS} attivo={vista} onChange={(id) => setVista(id === "campagna" ? "campagna" : "tipo")} />
      </div>

      {vista === "tipo" ? (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-ink-300/60">
                <th className="text-left font-medium px-5 py-3 sticky left-0 bg-surface-card text-ink-500">
                  Tipo campagna
                </th>
                {COLONNE_TIPO.map((c) => (
                  <th key={c.key} className="text-right font-medium px-4 py-3 whitespace-nowrap text-ink-500">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gruppi.map((g) => (
                <tr key={g.tipoCampagna} className="border-b border-ink-300/60">
                  <td className="px-5 py-3 sticky left-0 bg-surface-card text-ink-900 font-medium">{g.tipoCampagna}</td>
                  {COLONNE_TIPO.map((c) => (
                    <td key={c.key} className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">
                      {c.format(g[c.key] as number | null)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-5 py-3 font-semibold sticky left-0 bg-surface-card text-ink-900">Totale</td>
                {COLONNE_TIPO.map((c) => (
                  <td key={c.key} className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {c.format(totale[c.key] as number | null)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <p className="px-5 pb-2 text-xs text-ink-500">
            Solo le metriche da Meta Ads — vendite/fatturato sono tracciati solo per tipo campagna, non per singola campagna.
          </p>
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-ink-300/60">
                <th className="text-left font-medium px-5 py-3 sticky left-0 bg-surface-card text-ink-500">Campagna</th>
                <th className="text-left font-medium px-4 py-3 text-ink-500">Stato</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Investimento</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Lead</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Costo/Lead</th>
              </tr>
            </thead>
            <tbody>
              {campagne.map((c) => {
                const stato = formatStatoCampagna(c.stato);
                return (
                  <tr key={c.campaignId} className="border-b border-ink-300/60">
                    <td className="px-5 py-3 sticky left-0 bg-surface-card text-ink-900 font-medium">
                      {c.nomeCampagna}
                      <span className="block text-[11px] text-ink-500 font-normal">{c.tipoCampagna}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {stato ? (
                        <>
                          <Badge classe={stato.classe}>{stato.label}</Badge>
                          {c.statoDal && (
                            <span className="block text-[11px] text-ink-500 mt-1">dal {formatDataBreve(c.statoDal)}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatEuro(c.investimento)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatNumero(c.numeroLead)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatEuro(c.costoPerLead)}</td>
                  </tr>
                );
              })}
              {campagne.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-ink-500">
                    Nessuna campagna nel periodo selezionato.
                  </td>
                </tr>
              )}
              {campagne.length > 0 && (
                <tr>
                  <td className="px-5 py-3 font-semibold sticky left-0 bg-surface-card text-ink-900">Totale</td>
                  <td className="px-4 py-3" />
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatEuro(totaleCampagne.investimento)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatNumero(totaleCampagne.numeroLead)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatEuro(totaleCampagne.costoPerLead)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
