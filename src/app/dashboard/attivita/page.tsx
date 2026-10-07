import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getConsulenti } from "@/lib/sheets";
import { AttivitaGlobali } from "@/components/AttivitaGlobali";
import { Intestazione } from "@/components/ui/Intestazione";

export const metadata: Metadata = { title: "Attività" };

/**
 * Vista aggregata di tutte le attività dei clienti visibili (tutti per l'admin, i propri per il
 * consulente) — prima un consulente doveva aprire ogni cliente uno per uno per vedere le sue
 * attività (tab Attività dentro SchedaCliente.tsx, invariato). Stesso auth-gate di
 * dashboard/clienti/page.tsx: la voce non ha senso per il ruolo commerciale (dominio
 * cliente/roadmap, non prospect).
 */
export default async function AttivitaGlobaliPage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "commerciale") {
    redirect("/dashboard");
  }

  const consulenti = await getConsulenti();
  // Quick-filter "Le mie task" — nessuna identità "propria" per l'admin (vede tutti i clienti,
  // non ha un consulenteId in Sessione, vedi authz.ts), il quick-filter non compare in quel caso.
  const nomeConsulenteCorrente = consulenti.find((c) => c.consulenteId === sessione.consulenteId)?.nome;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Intestazione
        sopratitolo={sessione.ruolo === "admin" ? "Tutti i clienti" : "I tuoi clienti"}
        titolo="Attività."
        sottotitolo="Cosa c'è da fare, a partire da ciò che è in ritardo o scade questa settimana."
      />
      <AttivitaGlobali
        consulenti={consulenti.map((c) => ({ consulenteId: c.consulenteId, nome: c.nome }))}
        nomeConsulenteCorrente={nomeConsulenteCorrente}
      />
    </div>
  );
}
