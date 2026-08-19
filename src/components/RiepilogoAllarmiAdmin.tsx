import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { RiepilogoDashboard } from "@/lib/dashboardAdmin";

/**
 * Banner "salta all'occhio" in cima alla Dashboard Amministratore — l'admin deve capire in un
 * colpo d'occhio se ci sono clienti da controllare, prima ancora di scorrere la grid delle card.
 * Solo indicatore in pagina (nessuna notifica esterna), stessa famiglia di tinte di
 * src/lib/statusStyles.ts (successo/critico) — qui in forma di banner, non di pillola, quindi non
 * riusa direttamente Badge.
 */
export function RiepilogoAllarmiAdmin({ riepilogo }: { riepilogo: RiepilogoDashboard }) {
  const { clientiAdsCritici, clientiConAttivitaInRitardo, totaleAttivitaInRitardo } = riepilogo;
  const nessunProblema = clientiAdsCritici === 0 && clientiConAttivitaInRitardo === 0;

  if (nessunProblema) {
    return (
      <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4 flex items-center gap-2.5">
        <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-green-700">Tutto sotto controllo — nessun cliente da segnalare.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-red-700 mb-3">Da controllare</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle size={26} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-2xl font-bold text-ink-900 leading-none">{clientiAdsCritici}</p>
            <p className="text-xs text-ink-700 mt-1">
              {clientiAdsCritici === 1 ? "cliente con ads da intervenire" : "clienti con ads da intervenire"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={26} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-2xl font-bold text-ink-900 leading-none">{clientiConAttivitaInRitardo}</p>
            <p className="text-xs text-ink-700 mt-1">
              {clientiConAttivitaInRitardo === 1 ? "cliente con attività in ritardo" : "clienti con attività in ritardo"}
              {" "}({totaleAttivitaInRitardo} attività in totale)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
