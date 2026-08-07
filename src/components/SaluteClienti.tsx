import Link from "next/link";
import type { Cliente, KpiGroup, Salute } from "@/types/kpi";
import type { ValutazioneSalute } from "@/lib/salute";
import { formatEuro } from "@/lib/format";

export type SaluteClienteItem = {
  cliente: Cliente;
  totale: KpiGroup;
  valutazione: ValutazioneSalute;
};

const STILE_STATO: Record<Salute, { label: string; classe: string; icona: string }> = {
  interveni: { label: "Da intervenire", classe: "bg-red-50 text-red-700 border-red-100", icona: "🔴" },
  mantieni: { label: "Mantieni", classe: "bg-yellow-50 text-yellow-700 border-yellow-100", icona: "🟡" },
  scala: { label: "Scala", classe: "bg-green-50 text-green-700 border-green-100", icona: "🟢" },
  "dati-insufficienti": { label: "Dati insufficienti", classe: "bg-gray-50 text-gray-500 border-gray-200", icona: "⚪" },
  "no-target": { label: "Nessun target", classe: "bg-gray-50 text-gray-400 border-gray-200", icona: "⚪" },
};

export function SaluteClienti({ items }: { items: SaluteClienteItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 text-sm text-gray-500">
        Nessun cliente attivo.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map(({ cliente, valutazione }) => {
        const stile = STILE_STATO[valutazione.stato];
        return (
          <Link
            key={cliente.clienteId}
            href={`/dashboard?cliente=${encodeURIComponent(cliente.clienteId)}`}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 hover:border-brand/40 transition block"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900">{cliente.nome}</p>
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap ${stile.classe}`}>
                {stile.icona} {stile.label}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {valutazione.metricaUsata === "vendita" && "CPA su vendita"}
              {valutazione.metricaUsata === "lead" && "Costo per lead (proxy, nessuna vendita nel periodo)"}
              {!valutazione.metricaUsata && "Nessun target impostato"}
            </p>
            {valutazione.metricaUsata && (
              <p className="mt-1 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{formatEuro(valutazione.valoreAttuale)}</span>
                {" "}vs target{" "}
                <span className="font-semibold text-gray-900">{formatEuro(valutazione.targetUsato)}</span>
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
