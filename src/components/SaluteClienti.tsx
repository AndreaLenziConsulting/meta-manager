"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Clock } from "lucide-react";
import type { Consulente, Salute } from "@/types/kpi";
import type { SaluteClienteItem } from "@/lib/dashboardAdmin";
import { formatEuro, formatNumero } from "@/lib/format";
import { STILE_LIVELLO, type LivelloStato } from "@/lib/statusStyles";
import { ModificaClienteModal } from "@/components/ModificaClienteModal";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const STILE_STATO: Record<Salute, { label: string; tono: LivelloStato; soglia: string }> = {
  interveni: { label: "Da intervenire", tono: "critico", soglia: "> 120% del target" },
  mantieni: { label: "Mantieni", tono: "attenzione", soglia: "80–120% del target" },
  scala: { label: "Scala", tono: "successo", soglia: "≤ 80% del target" },
  "dati-insufficienti": { label: "Dati insufficienti", tono: "neutro", soglia: "spesa sotto 2,5× il target" },
  "no-target": { label: "Nessun target", tono: "neutro", soglia: "target non impostato in Clienti" },
};

/** Puntino colorato davanti all'etichetta di stato — sostituisce le emoji 🔴🟡🟢⚪. */
function Puntino({ tono }: { tono: LivelloStato }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${STILE_LIVELLO[tono].puntino}`} />;
}

export function LegendaSalute() {
  const ordine: Salute[] = ["scala", "mantieni", "interveni", "dati-insufficienti", "no-target"];
  return (
    <Card padding="sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500 mb-2">Legenda</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {ordine.map((stato) => {
          const stile = STILE_STATO[stato];
          return (
            <div key={stato} className="flex items-center gap-2 text-xs">
              <Badge tono={stile.tono}>
                <Puntino tono={stile.tono} />
                {stile.label}
              </Badge>
              <span className="text-ink-500">{stile.soglia}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-xs">
          <Badge tono="critico">
            <Clock size={11} />
            In ritardo
          </Badge>
          <span className="text-ink-500">almeno un&apos;attività aperta con scadenza passata</span>
        </div>
      </div>
    </Card>
  );
}

export function SaluteClienti({ items, consulenti }: { items: SaluteClienteItem[]; consulenti: Consulente[] }) {
  const router = useRouter();
  const [clienteInModifica, setClienteInModifica] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <Card padding="lg" className="text-sm text-ink-500">
        Nessun cliente attivo.
      </Card>
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
            <Card
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
              className="relative hover:border-brand/40 transition cursor-pointer"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setClienteInModifica(cliente.clienteId);
                }}
                className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold text-ink-500 hover:text-brand transition"
                aria-label={`Modifica ${cliente.nome}`}
              >
                <Pencil size={12} /> Modifica
              </button>

              <div className="pr-16">
                <p className="font-semibold text-ink-900">{cliente.nome}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge tono={stile.tono}>
                  <Puntino tono={stile.tono} />
                  {stile.label}
                </Badge>
                {attivitaInRitardo.length > 0 && (
                  <Badge tono="critico">
                    <Clock size={11} />
                    {attivitaInRitardo.length} in ritardo
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-500">
                {valutazione.metricaUsata === "vendita" && "CPA su vendita"}
                {valutazione.metricaUsata === "lead" && "Costo per lead"}
                {!valutazione.metricaUsata && "Nessun target impostato"}
              </p>
              {valutazione.metricaUsata && (
                <p className="mt-1 text-sm text-ink-700">
                  <span className="font-semibold text-ink-900">{formatEuro(valutazione.valoreAttuale)}</span>
                  {" "}vs target{" "}
                  <span className="font-semibold text-ink-900">{formatEuro(valutazione.targetUsato)}</span>
                </p>
              )}
              <p className="mt-2 text-[11px] text-ink-500">
                {formatEuro(investimento)} spesi · {formatNumero(numeroLead)} lead
              </p>
            </Card>
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
