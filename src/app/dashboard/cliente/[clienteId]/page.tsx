import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti, getGhlConnessioni, getSedi } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { SchedaCliente } from "@/components/SchedaCliente";
import { styleTemaCliente } from "@/lib/temaCliente";

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
    // font-sans qui, non solo nello style: font-family è dichiarato sul <body> (fuori da questo
    // wrapper) e le proprietà ereditate si "congelano" al valore già calcolato lì — il body non
    // ri-valuta var(--font-sans) per conto dei suoi discendenti. Ridichiararla su questo elemento
    // (dentro il quale --font-sans è già stata sovrascritta dallo style) la fa risolvere qui.
    <div
      className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6 font-sans"
      style={cliente ? styleTemaCliente(cliente) : undefined}
    >
      <SchedaCliente
        clienteId={clienteId}
        clienteNome={cliente?.nome}
        clienteEmail={cliente?.email}
        clienteLogoUrl={cliente?.logoUrl}
        tuttiITab
        haConnessioneGhl={haConnessioneGhl}
        ruoloAdmin={sessione.ruolo === "admin"}
      />
    </div>
  );
}
