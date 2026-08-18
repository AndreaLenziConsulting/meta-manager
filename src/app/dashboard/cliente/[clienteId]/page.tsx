import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { SchedaCliente } from "@/components/SchedaCliente";

export default async function ClienteSchedaPage({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const sessione = await getSessione();

  if (!sessione) {
    redirect("/login");
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    redirect("/dashboard");
  }
  const cliente = clienti.find((c) => c.clienteId === clienteId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <SchedaCliente clienteId={clienteId} clienteNome={cliente?.nome} clienteEmail={cliente?.email} tuttiITab />
    </div>
  );
}
