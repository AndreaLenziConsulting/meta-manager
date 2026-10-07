import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti, getConsulenti, getGhlConnessioni, getSedi } from "@/lib/archivio";
import { puoVedereCliente } from "@/lib/authz";
import { settimanaCorrente } from "@/lib/roadmap";
import { SchedaCliente } from "@/components/SchedaCliente";
import { styleTemaCliente } from "@/lib/temaCliente";

// Nella scheda del browser c'è il nome del cliente ("Niteko · Meta Manager ALC"): con più clienti
// aperti in schede diverse prima erano tutte uguali. Solo per chi può vedere quel cliente; la
// lettura dell'elenco è la stessa della pagina sotto (in cache per questa richiesta, nessuna in più).
export async function generateMetadata({ params }: { params: Promise<{ clienteId: string }> }): Promise<Metadata> {
  const { clienteId } = await params;
  const sessione = await getSessione();
  if (!sessione) return {};
  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) return {};
  return { title: clienti.find((c) => c.clienteId === clienteId)?.nome ?? "Cliente" };
}

export default async function ClienteSchedaPage({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { clienteId } = await params;
  const { tab } = await searchParams;
  const sessione = await getSessione();

  if (!sessione) {
    redirect("/login");
  }

  // Tutte insieme: una sola lettura del foglio invece di due (vedi le letture raggruppate in sheets.ts).
  const [clienti, sedi, connessioniGhl, consulenti] = await Promise.all([getClienti(), getSedi(), getGhlConnessioni(), getConsulenti()]);
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    redirect("/dashboard");
  }
  const cliente = clienti.find((c) => c.clienteId === clienteId);

  // Integrazione GHL/Squadd: le tessere Fatturato/Vendite/ROAS/CPA/Appuntamenti fissati del tab
  // KPI vengono lette in diretta da GHL solo se almeno una sede di questo cliente ha una
  // connessione attiva — vedi src/lib/kpiGhlOverlay.ts.
  const sediCliente = sedi.filter((s) => s.clienteId === clienteId);
  const sediIdsCliente = new Set(sediCliente.map((s) => s.sedeId));
  const haConnessioneGhl = connessioniGhl.some((c) => sediIdsCliente.has(c.sedeId) && c.attivo);

  const settimanaProgetto = cliente?.dataInizioProgetto ? settimanaCorrente(cliente.dataInizioProgetto) : null;

  // Quick-filter "Le mie task" del tab Attività — nessuna identità "propria" per l'admin (vede
  // tutti i clienti, non ha un consulenteId in Sessione, vedi authz.ts), il quick-filter non
  // compare in quel caso (AttivitaTab.tsx lo gated su questo prop essendo undefined).
  const nomeConsulenteCorrente = consulenti.find((c) => c.consulenteId === sessione.consulenteId)?.nome;

  return (
    // font-sans qui, non solo nello style: font-family è dichiarato sul <body> (fuori da questo
    // wrapper) e le proprietà ereditate si "congelano" al valore già calcolato lì — il body non
    // ri-valuta var(--font-sans) per conto dei suoi discendenti. Ridichiararla su questo elemento
    // (dentro il quale --font-sans è già stata sovrascritta dallo style) la fa risolvere qui.
    <div
      className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-6 space-y-6 font-sans"
      style={cliente ? styleTemaCliente(cliente) : undefined}
    >
      <SchedaCliente
        clienteId={clienteId}
        clienteNome={cliente?.nome}
        clienteEmail={cliente?.email}
        clienteLogoUrl={cliente?.logoUrl}
        settimanaProgetto={settimanaProgetto}
        driveFolderUrl={cliente?.driveFolderUrl}
        appuntamentiFileUrl={cliente?.appuntamentiFileUrl}
        tuttiITab
        haConnessioneGhl={haConnessioneGhl}
        ruoloAdmin={sessione.ruolo === "admin"}
        // Oggetto completo (non più solo consulenteId/nome) + sedi del cliente: servono al pennino
        // "Modifica cliente" nell'header (ClienteHeader.tsx → ModificaClienteModal), non solo
        // all'autocomplete assegnatari del tab Attività che li consumava finora.
        cliente={cliente}
        sedi={sediCliente}
        consulenti={consulenti}
        nomeConsulenteCorrente={nomeConsulenteCorrente}
        tabIniziale={typeof tab === "string" ? tab : undefined}
      />
    </div>
  );
}
