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

  // Integrazione GHL/Squadd: le tessere Fatturato/Vendite/ROAS/CPA/Appuntamenti fissati del tab
  // KPI vengono lette in diretta da GHL solo se almeno una sede di questo cliente ha una
  // connessione attiva — vedi src/lib/kpiGhlOverlay.ts.
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
        ruoloAdmin={sessione.ruolo === "admin"}
      />
    </div>
  );
}
