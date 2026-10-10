"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iniziali } from "@/lib/format";
import { raggruppaPerConsulente, type SaluteClienteItem } from "@/lib/dashboardAdmin";
import { ClienteRiga } from "@/components/SaluteClienti";
import { ModificaClienteModal } from "@/components/ModificaClienteModal";
import { CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";
import type { Consulente } from "@/types/kpi";

/**
 * Vista "roster" della pagina Clienti unificata (toggle "Per consulente" in DashboardClienti.tsx,
 * solo admin) — chi ha quanti clienti, chi è "in arrivo" con zero, invece dell'ordine per urgenza
 * di SaluteClienti.tsx (di cui riusa ClienteRiga, sempre in forma compatta: qui l'obiettivo è un
 * colpo d'occhio sul carico di lavoro, non la profondità delle card della vista priorità).
 * Modale di modifica duplicato deliberatamente da SaluteClienti.tsx (poche righe di stato
 * apri/chiudi, non vale l'astrazione per due viste indipendenti) — stesso principio già seguito da
 * AttivitaLista.tsx rispetto a RoadmapGantt.tsx.
 */
export function ClientiPerConsulente({
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

  const { gruppi, nonAssegnati } = raggruppaPerConsulente(items, consulenti);
  const nomeConsulentePer = new Map(consulenti.map((c) => [c.consulenteId, c.nome]));
  const itemInModifica = items.find((i) => i.cliente.clienteId === clienteInModifica) ?? null;

  if (gruppi.every((g) => g.items.length === 0) && nonAssegnati.length === 0) {
    return (
      <div className="rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-card)] p-6 text-sm text-ink-500">
        Nessun cliente attivo.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {gruppi.map(({ consulente, items: itemsConsulente }) => (
          <div key={consulente.consulenteId}>
            <IntestazioneGruppo nome={consulente.nome} conteggio={itemsConsulente.length} />
            {itemsConsulente.length > 0 ? (
              <div className="rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-card)] overflow-hidden divide-y divide-linea">
                {itemsConsulente.map((item) => (
                  <ClienteRiga
                    key={item.cliente.clienteId}
                    item={item}
                    nomeConsulente={nomeConsulentePer.get(item.cliente.consulenteId)}
                    onModifica={() => setClienteInModifica(item.cliente.clienteId)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">Nessun cliente assegnato ancora.</p>
            )}
          </div>
        ))}

        {nonAssegnati.length > 0 && (
          <div>
            <IntestazioneGruppo nome="Non assegnato" conteggio={nonAssegnati.length} />
            <div className="rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-card)] overflow-hidden divide-y divide-linea">
              {nonAssegnati.map((item) => (
                <ClienteRiga
                  key={item.cliente.clienteId}
                  item={item}
                  nomeConsulente={undefined}
                  onModifica={() => setClienteInModifica(item.cliente.clienteId)}
                />
              ))}
            </div>
          </div>
        )}
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

function IntestazioneGruppo({ nome, conteggio }: { nome: string; conteggio: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span aria-hidden="true" className="w-8 h-8 rounded-full bg-brand text-su-accento text-xs font-bold flex items-center justify-center flex-shrink-0">
        {iniziali(nome)}
      </span>
      <h2 className={CLASSE_TITOLO_SEZIONE}>{nome}</h2>
      <span className="flex-1 border-t border-linea" aria-hidden="true" />
      <span className="text-xs font-medium text-ink-500 flex-shrink-0">
        {conteggio > 0 ? `${conteggio} client${conteggio > 1 ? "i" : "e"}` : "In arrivo"}
      </span>
    </div>
  );
}
