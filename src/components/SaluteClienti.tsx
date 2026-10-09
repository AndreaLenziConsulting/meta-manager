"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Frown } from "lucide-react";
import type { Consulente, Salute } from "@/types/kpi";
import { perNomeCliente, type SaluteClienteItem } from "@/lib/dashboardAdmin";
import { formatEuro, formatNumero } from "@/lib/format";
import type { ValutazioneSalute } from "@/lib/salute";
import type { LivelloStato } from "@/lib/statusStyles";
import { ModificaClienteModal } from "@/components/ModificaClienteModal";
import { PallinoStato } from "@/components/ui/PallinoStato";
import { Badge } from "@/components/ui/Badge";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import { CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";

// Stato ads di un cliente: barra di 4px a sinistra della scheda nel colore di stato (la barra di
// accento del Design System ALC, qui letta contro il target) + badge con la parola. Prima la barra
// stava sopra e lo stato era testo colorato. `criterio` è il testo mostrato una sola volta
// nell'intestazione di zona, non per scheda.
const STILE_STATO: Record<Salute, { label: string; tono: LivelloStato; barraClasse: string; testoClasse: string }> = {
  interveni: { label: "Da intervenire", tono: "critico", barraClasse: "border-l-critico", testoClasse: "text-critico" },
  mantieni: { label: "Mantieni", tono: "attenzione", barraClasse: "border-l-attenzione", testoClasse: "text-attenzione" },
  scala: { label: "Scala", tono: "successo", barraClasse: "border-l-ok", testoClasse: "text-ok" },
  "dati-insufficienti": { label: "Dati insufficienti", tono: "neutro", barraClasse: "border-l-grigio", testoClasse: "text-ink-500" },
  "no-target": { label: "Nessun target", tono: "neutro", barraClasse: "border-l-grigio", testoClasse: "text-ink-500" },
};

type Zona = { key: string; titolo: string; criterio: string; compatta: boolean; items: SaluteClienteItem[] };

/**
 * "Costo per lead €15,20 vs target €10,00": il numero su cui è dato il giudizio. Solo se c'è un
 * target (senza, lo stato dice già "Nessun target" e non c'è nulla con cui confrontare).
 */
function CostoVsTarget({ valutazione }: { valutazione: ValutazioneSalute }) {
  if (!valutazione.metricaUsata) return null;
  const target = <span className="font-semibold text-ink-900">{formatEuro(valutazione.targetUsato)}</span>;
  // Senza lead (o vendite) nel periodo un costo non esiste: lo si dice, invece di scrivere "— vs target".
  if (valutazione.valoreAttuale === null) {
    return (
      <>
        {valutazione.metricaUsata === "vendita" ? "Nessuna vendita" : "Nessun lead"} nel periodo · target {target}
      </>
    );
  }
  return (
    <>
      {valutazione.metricaUsata === "vendita" ? "CPA su vendita" : "Costo per lead"}{" "}
      <span className="font-semibold text-ink-900">{formatEuro(valutazione.valoreAttuale)}</span> vs target {target}
    </>
  );
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
      className={`rounded-l-[4px] rounded-r-xl border border-linea border-l-4 ${stile.barraClasse} bg-surface-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-alta)] transition cursor-pointer py-4 pl-5 pr-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`${CLASSE_TITOLO_SEZIONE} truncate`}>{item.cliente.nome}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Badge tono={stile.tono}>{stile.label}</Badge>
            {nomeConsulente && <span className="text-ink-500 truncate">{nomeConsulente}</span>}
          </p>
        </div>
        <PulsanteIcona
          etichetta={`Modifica ${item.cliente.nome}`}
          className="-mt-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onModifica();
          }}
        >
          <Pencil size={16} aria-hidden="true" />
        </PulsanteIcona>
      </div>

      {item.sedi.length > 1 ? (
        // Più sedi: la valutazione aggregata in alto ("il peggio vince") non basta da sola a
        // capire dove intervenire — qui sotto ogni sede col proprio stato e, dal 09/10/2026 (segnalato
        // dall'utente: per chi ha più sedi il costo contro il target non si vedeva), col suo costo
        // per lead contro il suo target. Mai un unico CPA/target: apparterrebbe solo a una di esse.
        <div className="mt-3 space-y-2">
          {item.sedi.map((s) => {
            const stileSede = STILE_STATO[s.valutazione.stato];
            return (
              <div key={s.sede.sedeId} className="text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <PallinoStato tono={stileSede.tono} />
                  <span className="text-ink-700 font-medium">{s.sede.nome}</span>
                  <span className={`text-xs font-semibold ${stileSede.testoClasse}`}>{stileSede.label}</span>
                </div>
                {/* Rientrato quanto il pallino e il suo spazio: sta sotto il nome della sede. */}
                {s.valutazione.metricaUsata ? (
                  <p className="pl-3.5 text-xs leading-5 text-ink-700">
                    <CostoVsTarget valutazione={s.valutazione} />
                  </p>
                ) : (
                  // Una sede senza target: il suo costo per lead si vede lo stesso, se ha avuto lead.
                  s.numeroLead > 0 && (
                    <p className="pl-3.5 text-xs leading-5 text-ink-700">
                      Costo per lead <span className="font-semibold text-ink-900">{formatEuro(s.investimento / s.numeroLead)}</span>, senza un target impostato
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      ) : (
        item.valutazione.metricaUsata && (
          <p className="text-sm text-ink-700 mt-3">
            <CostoVsTarget valutazione={item.valutazione} />
          </p>
        )
      )}

      <p className="text-xs text-ink-500 mt-3 mr-2 pt-3 border-t border-linea">
        {formatEuro(item.investimento)} spesi · {formatNumero(item.numeroLead)} lead
        {item.attivitaInRitardo.length > 0 && (
          <span className="text-critico font-semibold"> · {item.attivitaInRitardo.length} in ritardo</span>
        )}
        {item.sentimentCritico && (
          <span className="text-critico font-semibold inline-flex items-center gap-1"> · <Frown size={12} aria-hidden="true" /> sentiment negativo</span>
        )}
      </p>
    </div>
  );
}

/** Esportata: riusata da ClientiPerConsulente.tsx (toggle "Per consulente" della pagina Clienti
 * unificata) — stessa riga compatta, per non duplicare markup tra le due viste. */
export function ClienteRiga({
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
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 pl-4 pr-2 bg-surface-card hover:bg-brand-light/40 transition cursor-pointer"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
        <PallinoStato tono={stile.tono} />
        <span className="text-sm font-semibold text-ink-900 truncate">{item.cliente.nome}</span>
        <span className="text-xs text-ink-500 flex-shrink-0">{stile.label}</span>
        {nomeConsulente && <span className="text-xs text-ink-500 flex-shrink-0">· {nomeConsulente}</span>}
        {item.attivitaInRitardo.length > 0 && (
          <span className="text-xs font-semibold text-critico flex-shrink-0">· {item.attivitaInRitardo.length} in ritardo</span>
        )}
        {item.sentimentCritico && (
          <span className="text-xs font-semibold text-critico flex-shrink-0 inline-flex items-center gap-1">
            · <Frown size={12} aria-hidden="true" /> sentiment negativo
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-ink-500 tabular-nums">
          {formatEuro(item.investimento)} · {formatNumero(item.numeroLead)} lead
        </span>
        <PulsanteIcona
          etichetta={`Modifica ${item.cliente.nome}`}
          onClick={(e) => {
            e.stopPropagation();
            onModifica();
          }}
        >
          <Pencil size={16} aria-hidden="true" />
        </PulsanteIcona>
      </div>
    </div>
  );
}

export function SaluteClienti({
  items,
  consulenti,
  ruoloAdmin,
}: {
  items: SaluteClienteItem[];
  consulenti: Consulente[];
  ruoloAdmin?: boolean;
}) {
  const router = useRouter();
  const [clienteInModifica, setClienteInModifica] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-card)] p-6 text-sm text-ink-500">
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
  // preserva l'ordine relativo esistente nelle prime due zone, dove il conteggio ritardi/severità
  // ads è un criterio di lettura voluto (più urgente = più in alto). Nella terza zona invece quello
  // stesso criterio non ha senso: "In linea o senza segnali" è per definizione "nessuna azione
  // richiesta ora", quindi un cliente con ads sano ma qualche attività in ritardo NON va comunque in
  // cima — segnalato dall'utente ("Questi non sono ancora in ordine alfabetico"): qui l'ordine
  // globale per priorità va esplicitamente scartato a favore del solo alfabetico.
  const zone: Zona[] = [
    {
      key: "interveni",
      titolo: "Da intervenire subito",
      criterio: "ads oltre il 120% del target",
      compatta: false,
      items: items.filter((i) => i.valutazione.stato === "interveni"),
    },
    {
      key: "mantieni",
      titolo: "Da monitorare",
      criterio: "ads tra 80% e 120% del target",
      compatta: false,
      items: items.filter((i) => i.valutazione.stato === "mantieni"),
    },
    {
      key: "altro",
      titolo: "In linea o senza segnali",
      criterio: "nessuna azione richiesta ora",
      compatta: true,
      items: items.filter((i) => ["scala", "dati-insufficienti", "no-target"].includes(i.valutazione.stato)).sort(perNomeCliente),
    },
  ].filter((z) => z.items.length > 0);

  return (
    <>
      <div className="space-y-8">
        {zone.map((zona) => (
          <section key={zona.key} aria-labelledby={`zona-${zona.key}`}>
            <div className="flex items-baseline gap-x-2.5 gap-y-1 flex-wrap mb-3">
              <h2 id={`zona-${zona.key}`} className={CLASSE_TITOLO_SEZIONE}>
                {zona.titolo}
              </h2>
              <span className="text-xs font-medium text-ink-500">
                {zona.items.length} {zona.items.length === 1 ? "cliente" : "clienti"} · {zona.criterio}
              </span>
            </div>

            {zona.compatta ? (
              <div className="rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-card)] overflow-hidden divide-y divide-linea">
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
          </section>
        ))}
      </div>

      {itemInModifica && (
        <ModificaClienteModal
          cliente={itemInModifica.cliente}
          sedi={itemInModifica.sedi.map((s) => s.sede)}
          consulenti={consulenti}
          ruoloAdmin={ruoloAdmin}
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
