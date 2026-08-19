"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Consulente, Salute } from "@/types/kpi";
import type { SaluteClienteItem } from "@/lib/dashboardAdmin";
import { formatEuro, formatNumero } from "@/lib/format";
import { STILE_LIVELLO } from "@/lib/statusStyles";
import { ModificaClienteModal } from "@/components/ModificaClienteModal";

const STILE_STATO: Record<Salute, { label: string; classe: string; icona: string; soglia: string }> = {
  interveni: { label: "Da intervenire", classe: STILE_LIVELLO.critico.classe, icona: "🔴", soglia: "> 120% del target" },
  mantieni: { label: "Mantieni", classe: STILE_LIVELLO.attenzione.classe, icona: "🟡", soglia: "80–120% del target" },
  scala: { label: "Scala", classe: STILE_LIVELLO.successo.classe, icona: "🟢", soglia: "≤ 80% del target" },
  "dati-insufficienti": { label: "Dati insufficienti", classe: STILE_LIVELLO.neutro.classe, icona: "⚪", soglia: "spesa sotto 2,5× il target" },
  "no-target": { label: "Nessun target", classe: STILE_LIVELLO.neutro.classe, icona: "⚪", soglia: "target non impostato in Clienti" },
};

export function LegendaSalute() {
  const ordine: Salute[] = ["scala", "mantieni", "interveni", "dati-insufficienti", "no-target"];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Legenda</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {ordine.map((stato) => {
          const stile = STILE_STATO[stato];
          return (
            <div key={stato} className="flex items-center gap-2 text-xs">
              <span className={`font-semibold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap ${stile.classe}`}>
                {stile.icona} {stile.label}
              </span>
              <span className="text-gray-500">{stile.soglia}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap bg-red-50 text-red-700 border-red-100">
            ⏰ In ritardo
          </span>
          <span className="text-gray-500">almeno un&apos;attività aperta con scadenza passata</span>
        </div>
      </div>
    </div>
  );
}

export function SaluteClienti({ items, consulenti }: { items: SaluteClienteItem[]; consulenti: Consulente[] }) {
  const router = useRouter();
  const [clienteInModifica, setClienteInModifica] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 text-sm text-gray-500">
        Nessun cliente attivo.
      </div>
    );
  }

  const itemInModifica = items.find((i) => i.cliente.clienteId === clienteInModifica) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(({ cliente, investimento, numeroLead, valutazione, attivitaInRitardo }) => {
          const stile = STILE_STATO[valutazione.stato];
          const href = `/dashboard/cliente/${encodeURIComponent(cliente.clienteId)}`;
          return (
            <div
              key={cliente.clienteId}
              role="link"
              tabIndex={0}
              onClick={() => router.push(href)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(href);
                }
              }}
              className="relative rounded-2xl border border-gray-200 bg-white shadow-sm p-4 hover:border-brand/40 transition cursor-pointer"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setClienteInModifica(cliente.clienteId);
                }}
                className="absolute top-3 right-3 text-[11px] font-semibold text-gray-400 hover:text-brand transition"
                aria-label={`Modifica ${cliente.nome}`}
              >
                ✎ Modifica
              </button>

              <div className="pr-16">
                <p className="font-semibold text-gray-900">{cliente.nome}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap ${stile.classe}`}>
                  {stile.icona} {stile.label}
                </span>
                {attivitaInRitardo.length > 0 && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap bg-red-50 text-red-700 border-red-100">
                    ⏰ {attivitaInRitardo.length} in ritardo
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {valutazione.metricaUsata === "vendita" && "CPA su vendita"}
                {valutazione.metricaUsata === "lead" && "Costo per lead"}
                {!valutazione.metricaUsata && "Nessun target impostato"}
              </p>
              {valutazione.metricaUsata && (
                <p className="mt-1 text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">{formatEuro(valutazione.valoreAttuale)}</span>
                  {" "}vs target{" "}
                  <span className="font-semibold text-gray-900">{formatEuro(valutazione.targetUsato)}</span>
                </p>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                {formatEuro(investimento)} spesi · {formatNumero(numeroLead)} lead
              </p>
            </div>
          );
        })}
      </div>

      {itemInModifica && (
        <ModificaClienteModal
          cliente={itemInModifica.cliente}
          consulenti={consulenti}
          onClose={() => setClienteInModifica(null)}
          onSalvato={() => {
            setClienteInModifica(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
