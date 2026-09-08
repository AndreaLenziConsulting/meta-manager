import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { MeetingGlobali } from "@/components/MeetingGlobali";

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
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-xl text-ink-900">Meeting</h2>
        <p className="text-sm text-ink-500 mt-1">
          {sessione.ruolo === "admin" ? "Tutti i meeting di tutti i clienti." : "Tutti i meeting dei tuoi clienti."}
        </p>
      </div>
      <MeetingGlobali />
    </div>
  );
}
