import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";
import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessione = await getSessione();

  if (!sessione) {
    redirect("/login");
  }

  const clienti = clientiVisibili(sessione, await getClienti()).map((c) => ({
    clienteId: c.clienteId,
    nome: c.nome,
  }));

  return (
    <DashboardShell clienti={clienti} ruolo={sessione.ruolo}>
      {children}
    </DashboardShell>
  );
}
