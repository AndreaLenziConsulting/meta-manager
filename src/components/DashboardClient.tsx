"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { SchedaCliente } from "@/components/SchedaCliente";
import type { Ruolo } from "@/types/kpi";

type ClienteOption = { clienteId: string; nome: string };

export function DashboardClient({
  clientiIniziali,
  ruolo,
}: {
  clientiIniziali: ClienteOption[];
  ruolo: Ruolo;
}) {
  const searchParams = useSearchParams();
  const clienteDaQuery = searchParams.get("cliente");
  const iniziale =
    (clienteDaQuery && clientiIniziali.some((c) => c.clienteId === clienteDaQuery) && clienteDaQuery) ||
    clientiIniziali[0]?.clienteId ||
    "";
  const [clienteId, setClienteId] = useState<string>(iniziale);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-gray-900">Dashboard team</h2>
          <div className="flex items-center gap-3">
            {ruolo === "admin" && (
              <a
                href="/dashboard/salute"
                className="text-sm font-semibold text-brand hover:underline whitespace-nowrap"
              >
                Salute clienti
              </a>
            )}
            {clientiIniziali.length > 0 && (
              <ClientSwitcher clienti={clientiIniziali} value={clienteId} onChange={setClienteId} />
            )}
          </div>
        </div>

        {clienteId ? (
          <SchedaCliente clienteId={clienteId} tuttiITab />
        ) : (
          <p className="text-sm text-gray-500">Nessun cliente assegnato.</p>
        )}
      </div>
    </div>
  );
}
