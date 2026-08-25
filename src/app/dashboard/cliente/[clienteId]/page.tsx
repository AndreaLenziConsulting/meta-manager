import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti, getGhlConnessioni, getSedi } from "@/lib/sheets";
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

  // Fase 1 integrazione GHL/Squadd: il tab "Vendite (GHL)" compare solo se almeno una sede di
  // questo cliente ha una connessione attiva — vedi src/components/GhlPanel.tsx.
  const [sedi, connessioniGhl] = await Promise.all([getSedi(), getGhlConnessioni()]);
  const sediIdsCliente = new Set(sedi.filter((s) => s.clienteId === clienteId).map((s) => s.sedeId));
  const haConnessioneGhl = connessioniGhl.some((c) => sediIdsCliente.has(c.sedeId) && c.attivo);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <SchedaCliente
        clienteId={clienteId}
        clienteNome={cliente?.nome}
        clienteEmail={cliente?.email}
        tuttiITab
        haConnessioneGhl={haConnessioneGhl}
      />
    </div>
  );
}
