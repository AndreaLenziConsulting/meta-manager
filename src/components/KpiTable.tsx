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
    <div
      className="rounded-xl border overflow-x-auto"
      style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)" }}
    >
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
            <th className="text-left font-medium px-4 py-3 sticky left-0" style={{ color: "var(--text-secondary)", background: "var(--surface-1)" }}>
              Tipo campagna
            </th>
            {COLONNE.map((c) => (
              <th key={c.key} className="text-right font-medium px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gruppi.map((g) => (
            <tr key={g.tipoCampagna} style={{ borderBottom: "1px solid var(--gridline)" }}>
              <td className="px-4 py-3 sticky left-0" style={{ color: "var(--text-primary)", background: "var(--surface-1)" }}>
                {g.tipoCampagna}
              </td>
              {COLONNE.map((c) => (
                <td
                  key={c.key}
                  className="text-right px-4 py-3 whitespace-nowrap tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {c.format(g[c.key] as number | null)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="px-4 py-3 font-semibold sticky left-0" style={{ color: "var(--text-primary)", background: "var(--surface-1)" }}>
              Totale
            </td>
            {COLONNE.map((c) => (
              <td key={c.key} className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums" style={{ color: "var(--text-primary)" }}>
                {c.format(totale[c.key] as number | null)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
