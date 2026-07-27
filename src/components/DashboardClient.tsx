"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { KpiDashboard } from "@/components/KpiDashboard";

type ClienteOption = { clienteId: string; nome: string };

export function DashboardClient() {
  const router = useRouter();
  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [clienteId, setClienteId] = useState<string>("");

  useEffect(() => {
    fetch("/api/clienti")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setClienti(data.clienti);
        if (data.clienti.length > 0) setClienteId(data.clienti[0].clienteId);
      });
  }, [router]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Meta Manager ALC</h1>
        {clienti.length > 0 && <ClientSwitcher clienti={clienti} value={clienteId} onChange={setClienteId} />}
      </div>

      {clienteId && <KpiDashboard clienteId={clienteId} />}
    </div>
  );
}
