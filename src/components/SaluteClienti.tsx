"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { Consulente, Salute } from "@/types/kpi";
import type { SaluteClienteItem } from "@/lib/dashboardAdmin";
import { formatEuro, formatNumero } from "@/lib/format";
import { STILE_LIVELLO, type LivelloStato } from "@/lib/statusStyles";
import { ModificaClienteModal } from "@/components/ModificaClienteModal";

// Trattamento a rail (bordo superiore colorato) + etichetta di testo, non più a pillola — le tinte
// restano le stesse di STILE_LIVELLO ma qui vanno scomposte in bordo/testo separati, cosa che la
// stringa unica `classe` non permette: stessa scelta già presa per il banner di
// RiepilogoAllarmiAdmin.tsx (trattamento diverso dalla pillola standard, colori letti dalla stessa
// famiglia). `criterio` è il testo mostrato una sola volta nell'header di zona, non per card.
const STILE_STATO: Record<Salute, { label: string; tono: LivelloStato; railClasse: string; testoClasse: string }> = {
  interveni: { label: "Da intervenire", tono: "critico", railClasse: "border-t-red-400", testoClasse: "text-red-600" },
  mantieni: { label: "Mantieni", tono: "attenzione", railClasse: "border-t-yellow-400", testoClasse: "text-yellow-700" },
  scala: { label: "Scala", tono: "successo", railClasse: "border-t-green-400", testoClasse: "text-green-700" },
  "dati-insufficienti": { label: "Dati insufficienti", tono: "neutro", railClasse: "border-t-ink-300", testoClasse: "text-ink-500" },
  "no-target": { label: "Nessun target", tono: "neutro", railClasse: "border-t-ink-300", testoClasse: "text-ink-500" },
};

type Zona = { key: string; titolo: string; criterio: string; titoloClasse: string; compatta: boolean; items: SaluteClienteItem[] };

/** Puntino colorato — sostituisce le emoji 🔴🟡🟢⚪, usato nelle righe compatte della zona "in linea". */
function Puntino({ tono }: { tono: LivelloStato }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${STILE_LIVELLO[tono].puntino}`} />;
}

function ClienteCard({
  item,
  nomeConsulente,
  onModifica,
}: {
  item: SaluteClienteItem;
  nomeConsulente: string | undefined;
  onModifica: () => void;
}) {
  const router = useRouter();
  const stile = STILE_STATO[item.valutazione.stato];
  const href = `/dashboard/cliente/${encodeURIComponent(item.cliente.clienteId)}`;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={`rounded-2xl border border-ink-300 border-t-4 ${stile.railClasse} bg-surface-card shadow-sm p-5 hover:shadow-md transition cursor-pointer`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading font-bold text-ink-900 text-lg truncate">{item.cliente.nome}</p>
          <p className="text-xs mt-0.5 flex items-center gap-1.5">
            <span className={`font-bold ${stile.testoClasse}`}>{stile.label}</span>
            {nomeConsulente && <span className="text-ink-500 truncate">· {nomeConsulente}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onModifica();
          }}
          className="text-ink-500 hover:text-brand transition flex-shrink-0 cursor-pointer"
          aria-label={`Modifica ${item.cliente.nome}`}
        >
          <Pencil size={14} />
        </button>
      </div>

      {item.sedi.length > 1 ? (
        // Più sedi: la valutazione aggregata in alto ("il peggio vince") non basta da sola a
        // capire dove intervenire — qui sotto ogni sede col proprio stato, non un unico CPA/target
        // che apparterrebbe solo a una di esse.
        <div className="mt-3 space-y-1.5">
          {item.sedi.map((s) => {
            const stileSede = STILE_STATO[s.valutazione.stato];
            return (
              <div key={s.sede.sedeId} className="flex items-center gap-2 text-sm">
                <Puntino tono={stileSede.tono} />
                <span className="text-ink-700 font-medium">{s.sede.nome}</span>
                <span className={`text-xs font-semibold ${stileSede.testoClasse}`}>{stileSede.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        item.valutazione.metricaUsata && (
          <p className="text-sm text-ink-700 mt-3">
            {item.valutazione.metricaUsata === "vendita" ? "CPA su vendita" : "Costo per lead"}{" "}
            <span className="font-semibold text-ink-900">{formatEuro(item.valutazione.valoreAttuale)}</span> vs target{" "}
            <span className="font-semibold text-ink-900">{formatEuro(item.valutazione.targetUsato)}</span>
          </p>
        )
      )}

      <p className="text-xs text-ink-500 mt-3 pt-3 border-t border-ink-300/60">
        {formatEuro(item.investimento)} spesi · {formatNumero(item.numeroLead)} lead
        {item.attivitaInRitardo.length > 0 && (
          <span className="text-red-600 font-semibold"> · {item.attivitaInRitardo.length} in ritardo</span>
        )}
      </p>
    </div>
  );
}

function ClienteRiga({
  item,
  nomeConsulente,
  onModifica,
}: {
  item: SaluteClienteItem;
  nomeConsulente: string | undefined;
  onModifica: () => void;
}) {
  const router = useRouter();
  const stile = STILE_STATO[item.valutazione.stato];
  const href = `/dashboard/cliente/${encodeURIComponent(item.cliente.clienteId)}`;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 bg-surface-card hover:bg-brand-light/40 transition cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Puntino tono={stile.tono} />
        <span className="text-sm font-medium text-ink-700 truncate">{item.cliente.nome}</span>
        <span className="text-[11px] text-ink-500 flex-shrink-0">{stile.label}</span>
        {nomeConsulente && <span className="text-[11px] text-ink-500 flex-shrink-0">· {nomeConsulente}</span>}
        {item.attivitaInRitardo.length > 0 && (
          <span className="text-[11px] font-semibold text-red-600 flex-shrink-0">· {item.attivitaInRitardo.length} in ritardo</span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[11px] text-ink-500 tabular-nums">
          {formatEuro(item.investimento)} · {formatNumero(item.numeroLead)} lead
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onModifica();
          }}
          className="text-ink-500 hover:text-brand transition cursor-pointer"
          aria-label={`Modifica ${item.cliente.nome}`}
        >
          <Pencil size={12} />
        </button>
      </div>
    </div>
  );
}

export function SaluteClienti({ items, consulenti }: { items: SaluteClienteItem[]; consulenti: Consulente[] }) {
  const router = useRouter();
  const [clienteInModifica, setClienteInModifica] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-6 text-sm text-ink-500">
        Nessun cliente attivo.
      </div>
    );
  }

  const itemInModifica = items.find((i) => i.cliente.clienteId === clienteInModifica) ?? null;
  const apriModifica = (clienteId: string) => setClienteInModifica(clienteId);

  // Solo il nome (non un raggruppamento): le zone di urgenza restano il criterio primario di
  // lettura di questa pagina ("colpo d'occhio su dove intervenire", scelta di Fase C) — vedere
  // il carico raggruppato per consulente sta nella pagina Clienti (dashboard/clienti/page.tsx).
  const nomeConsulentePer = new Map(consulenti.map((c) => [c.consulenteId, c.nome]));

  // Bucket per urgenza sull'array già ordinato da ordinaPerPriorita (dashboard/page.tsx) — .filter()
  // preserva l'ordine relativo esistente, nessuna nuova logica di ordinamento qui.
  const zone: Zona[] = [
    {
      key: "interveni",
      titolo: "Da intervenire subito",
      criterio: "ads oltre il 120% del target",
      titoloClasse: "text-red-600",
      compatta: false,
      items: items.filter((i) => i.valutazione.stato === "interveni"),
    },
    {
      key: "mantieni",
      titolo: "Da monitorare",
      criterio: "ads tra 80% e 120% del target",
      titoloClasse: "text-yellow-700",
      compatta: false,
      items: items.filter((i) => i.valutazione.stato === "mantieni"),
    },
    {
      key: "altro",
      titolo: "In linea o senza segnali",
      criterio: "nessuna azione richiesta ora",
      titoloClasse: "text-ink-700",
      compatta: true,
      items: items.filter((i) => ["scala", "dati-insufficienti", "no-target"].includes(i.valutazione.stato)),
    },
  ].filter((z) => z.items.length > 0);

  return (
    <>
      <div className="space-y-8">
        {zone.map((zona) => (
          <div key={zona.key}>
            <div className="flex items-baseline gap-x-2.5 gap-y-1 flex-wrap mb-3">
              <h3 className={`font-heading font-bold text-lg ${zona.titoloClasse}`}>{zona.titolo}</h3>
              <span className="text-xs text-ink-500">
                {zona.items.length} {zona.items.length === 1 ? "cliente" : "clienti"} — {zona.criterio}
              </span>
            </div>

            {zona.compatta ? (
              <div className="rounded-2xl border border-ink-300 overflow-hidden divide-y divide-ink-300/60">
                {zona.items.map((item) => (
                  <ClienteRiga
                    key={item.cliente.clienteId}
                    item={item}
                    nomeConsulente={nomeConsulentePer.get(item.cliente.consulenteId)}
                    onModifica={() => apriModifica(item.cliente.clienteId)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {zona.items.map((item) => (
                  <ClienteCard
                    key={item.cliente.clienteId}
                    item={item}
                    nomeConsulente={nomeConsulentePer.get(item.cliente.consulenteId)}
                    onModifica={() => apriModifica(item.cliente.clienteId)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {itemInModifica && (
        <ModificaClienteModal
          cliente={itemInModifica.cliente}
          sedi={itemInModifica.sedi.map((s) => s.sede)}
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
