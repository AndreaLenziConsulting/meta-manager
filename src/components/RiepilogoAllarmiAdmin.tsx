import type { RiepilogoDashboard } from "@/lib/dashboardAdmin";

/**
 * Banner "salta all'occhio" in cima alla Dashboard Amministratore — l'admin deve capire in un
 * colpo d'occhio se ci sono clienti da controllare, prima ancora di scorrere la grid delle card.
 * Solo indicatore in pagina (nessuna notifica esterna), palette status già in uso in
 * SaluteClienti.tsx (STILE_STATO.interveni), nessun colore nuovo.
 */
export function RiepilogoAllarmiAdmin({ riepilogo }: { riepilogo: RiepilogoDashboard }) {
  const { clientiAdsCritici, clientiConAttivitaInRitardo, totaleAttivitaInRitardo } = riepilogo;
  const nessunProblema = clientiAdsCritici === 0 && clientiConAttivitaInRitardo === 0;

  if (nessunProblema) {
    return (
      <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4 flex items-center gap-2.5">
        <span className="text-xl">🟢</span>
        <p className="text-sm font-semibold text-green-700">Tutto sotto controllo — nessun cliente da segnalare.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-red-700 mb-3">Da controllare</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔴</span>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{clientiAdsCritici}</p>
            <p className="text-xs text-gray-600 mt-1">
              {clientiAdsCritici === 1 ? "cliente con ads da intervenire" : "clienti con ads da intervenire"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{clientiConAttivitaInRitardo}</p>
            <p className="text-xs text-gray-600 mt-1">
              {clientiConAttivitaInRitardo === 1 ? "cliente con attività in ritardo" : "clienti con attività in ritardo"}
              {" "}({totaleAttivitaInRitardo} attività in totale)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
