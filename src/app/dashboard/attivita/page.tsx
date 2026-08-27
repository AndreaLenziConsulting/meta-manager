import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { AttivitaGlobali } from "@/components/AttivitaGlobali";

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

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-xl text-ink-900">Attività</h2>
        <p className="text-sm text-ink-500 mt-1">
          {sessione.ruolo === "admin" ? "Tutte le attività di tutti i clienti." : "Tutte le attività dei tuoi clienti."}
        </p>
      </div>
      <AttivitaGlobali />
    </div>
  );
}
