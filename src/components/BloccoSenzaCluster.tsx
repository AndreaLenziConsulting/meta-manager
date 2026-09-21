import { formatEuro, formatNumero } from "@/lib/format";
import { STILE_LIVELLO } from "@/lib/statusStyles";
import type { GhlBreakdownTag } from "@/types/ghl";

/**
 * Quarto blocco accanto ai blocchi per categoria in PacingTargetChart.tsx (20/09/2026, segnalato
 * dall'utente: i totali di sede non coincidevano con la somma dei blocchi per categoria — 3 dei 5
 * appuntamenti del mese appartenevano a contatti senza nessun tag cluster). Deliberatamente SENZA
 * target/meter/stato di pacing (a differenza di BloccoPacing): "senza cluster" non è un obiettivo da
 * raggiungere, è un gap di tagging in GHL da chiudere — mostra solo i conteggi attuali, per non far
 * sparire in silenzio numeri che il totale sede include ma nessun cluster cattura. Stile
 * STILE_LIVELLO.attenzione (giallo) per lo stesso motivo: un avviso operativo, non un dato negativo.
 */
export function BloccoSenzaCluster({ dati }: { dati: GhlBreakdownTag }) {
  const stile = STILE_LIVELLO.attenzione;
  return (
    <div className={`rounded-xl border p-4 ${stile.classe}`}>
      <p className="text-xs font-semibold mb-1">Senza cluster</p>
      <p className="text-[11px] mb-3 opacity-80">
        Contatti senza nessuno dei tag configurati sopra — non rientrano in nessun cluster. Assegna un tag in GHL per includerli.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <RigaConteggio etichetta="Richieste" valore={formatNumero(dati.richieste)} />
        <RigaConteggio etichetta="Appuntamenti" valore={formatNumero(dati.appuntamenti.totali)} />
        <RigaConteggio etichetta="Vendite" valore={formatNumero(dati.opportunita.vendite)} />
        <RigaConteggio etichetta="Fatturato" valore={formatEuro(dati.opportunita.fatturato)} />
      </div>
    </div>
  );
}

function RigaConteggio({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="opacity-80">{etichetta}</span>
      <span className="font-semibold tabular-nums">{valore}</span>
    </div>
  );
}
