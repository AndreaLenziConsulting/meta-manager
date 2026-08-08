"use client";

import { useRouter, usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import type { Ruolo } from "@/types/kpi";

type ClienteOption = { clienteId: string; nome: string };

export function TeamHeader({ clienti, ruolo }: { clienti: ClienteOption[]; ruolo: Ruolo }) {
  const router = useRouter();
  const pathname = usePathname();

  const match = pathname.match(/^\/dashboard\/cliente\/([^/]+)/);
  const clienteAttuale = match ? decodeURIComponent(match[1]) : "";

  return (
    <AppHeader>
      {ruolo === "admin" && (
        <a href="/dashboard" className="text-sm font-semibold text-brand hover:underline whitespace-nowrap">
          Salute clienti
        </a>
      )}
      {clienti.length > 0 && (
        <ClientSwitcher
          clienti={clienti}
          value={clienteAttuale}
          placeholder="Seleziona cliente"
          onChange={(id) => router.push(`/dashboard/cliente/${encodeURIComponent(id)}`)}
        />
      )}
    </AppHeader>
  );
}
