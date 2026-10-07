import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { MeetingGlobali } from "@/components/MeetingGlobali";
import { Intestazione } from "@/components/ui/Intestazione";

export const metadata: Metadata = { title: "Meeting" };

/**
 * Vista aggregata di tutti i meeting dei clienti visibili (tutti per l'admin, i propri per il
 * consulente) — mirror di dashboard/attivita/page.tsx: prima un consulente doveva aprire ogni
 * cliente uno per uno per vedere i suoi meeting (tab Meeting dentro SchedaCliente.tsx, invariato).
 * Stesso auth-gate di dashboard/attivita/page.tsx: la voce non ha senso per il ruolo commerciale
 * (dominio cliente/roadmap, non prospect).
 */
export default async function MeetingGlobaliPage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "commerciale") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Intestazione
        sopratitolo={sessione.ruolo === "admin" ? "Tutti i clienti" : "I tuoi clienti"}
        titolo="Meeting."
        sottotitolo="I report degli incontri con i clienti, dal più recente."
      />
      <MeetingGlobali />
    </div>
  );
}
