"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { Cliente, Consulente, Sede } from "@/types/kpi";
import { ModificaClienteModal } from "@/components/ModificaClienteModal";

/**
 * Griglia clienti della pagina "Clienti" (dashboard/clienti/page.tsx) — prima solo un elenco di
 * sola lettura (`<a href=...>`), qui promossa a client component per aggiungere il pulsante
 * "Modifica" per-cliente che apre lo stesso ModificaClienteModal già in uso nella Dashboard
 * Amministratore (SaluteClienti.tsx), così l'unico posto per creare/modificare un cliente non resta
 * più solo la home admin. `isAdmin` nasconde il pulsante per un consulente (che vede comunque questa
 * pagina, ma solo in lettura — le route PATCH/POST sotto restano comunque admin-only lato server).
 */
export function ClientiGrid({
  clienti,
  sedi,
  consulenti,
  nomeProdottoPer,
  isAdmin,
}: {
  clienti: Cliente[];
  sedi: Sede[];
  consulenti: Consulente[];
  nomeProdottoPer: Map<string, string>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [clienteInModifica, setClienteInModifica] = useState<string | null>(null);

  const clienteModifica = clienti.find((c) => c.clienteId === clienteInModifica) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clienti.map((c) => {
          const sediDelCliente = sedi.filter((s) => s.clienteId === c.clienteId);
          const nSediAttive = sediDelCliente.filter((s) => s.attivo).length;
          const nomeProdotto = c.prodottoId ? nomeProdottoPer.get(c.prodottoId) : null;
          const href = `/dashboard/cliente/${encodeURIComponent(c.clienteId)}`;
          return (
            <div
              key={c.clienteId}
              role="link"
              tabIndex={0}
              onClick={() => router.push(href)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(href);
                }
              }}
              className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading font-bold text-ink-900 text-base truncate">{c.nome}</p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClienteInModifica(c.clienteId);
                    }}
                    className="text-ink-500 hover:text-brand transition flex-shrink-0 cursor-pointer"
                    aria-label={`Modifica ${c.nome}`}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              {nomeProdotto && <p className="text-xs text-ink-500 mt-0.5">{nomeProdotto}</p>}
              <p className="text-[11px] text-ink-500 mt-2.5 pt-2.5 border-t border-ink-300/60">
                {nSediAttive > 0 ? `${nSediAttive} sed${nSediAttive > 1 ? "i attive" : "e attiva"}` : "Nessuna sede attiva"}
              </p>
            </div>
          );
        })}
      </div>

      {clienteModifica && (
        <ModificaClienteModal
          cliente={clienteModifica}
          sedi={sedi.filter((s) => s.clienteId === clienteModifica.clienteId)}
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
