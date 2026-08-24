"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
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
        <Link href="/dashboard" className="text-sm font-semibold text-brand hover:underline whitespace-nowrap">
          Dashboard Amministratore
        </Link>
      )}
      {(ruolo === "admin" || ruolo === "commerciale") && (
        <Link href="/dashboard/commerciale" className="text-sm font-semibold text-brand hover:underline whitespace-nowrap">
          Prospect
        </Link>
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
