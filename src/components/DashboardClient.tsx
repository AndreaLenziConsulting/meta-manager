"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { KpiDashboard } from "@/components/KpiDashboard";

type ClienteOption = { clienteId: string; nome: string };

export function DashboardClient({ clientiIniziali }: { clientiIniziali: ClienteOption[] }) {
  const [clienteId, setClienteId] = useState<string>(clientiIniziali[0]?.clienteId ?? "");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">Dashboard team</h2>
          {clientiIniziali.length > 0 && (
            <ClientSwitcher clienti={clientiIniziali} value={clienteId} onChange={setClienteId} />
          )}
        </div>

        {clienteId && <KpiDashboard clienteId={clienteId} />}
      </div>
    </div>
  );
}
