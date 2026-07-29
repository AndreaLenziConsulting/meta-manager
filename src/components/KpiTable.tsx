import type { KpiGroup } from "@/types/kpi";
import { formatEuro, formatNumero, formatPercentuale, formatRoas } from "@/lib/format";

const COLONNE: { key: keyof KpiGroup; label: string; format: (v: number | null) => string }[] = [
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

export function KpiTable({ gruppi, totale }: { gruppi: KpiGroup[]; totale: KpiGroup }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-semibold text-gray-900 text-[15px]">Dettaglio per tipo campagna</h3>
      </div>
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left font-medium px-5 py-3 sticky left-0 bg-white text-gray-500">
                Tipo campagna
              </th>
              {COLONNE.map((c) => (
                <th key={c.key} className="text-right font-medium px-4 py-3 whitespace-nowrap text-gray-500">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gruppi.map((g) => (
              <tr key={g.tipoCampagna} className="border-b border-gray-100">
                <td className="px-5 py-3 sticky left-0 bg-white text-gray-900 font-medium">
                  {g.tipoCampagna}
                </td>
                {COLONNE.map((c) => (
                  <td key={c.key} className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-gray-700">
                    {c.format(g[c.key] as number | null)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-5 py-3 font-semibold sticky left-0 bg-white text-gray-900">Totale</td>
              {COLONNE.map((c) => (
                <td key={c.key} className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-gray-900">
                  {c.format(totale[c.key] as number | null)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
