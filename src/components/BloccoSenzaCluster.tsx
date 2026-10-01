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
 *
 * Riusato (01/10/2026) anche per un cluster VERO che ha dati GHL ma nessun target impostato
 * (`titolo`/`descrizione`/`neutro`): senza target BloccoPacing non disegna nulla e il cluster
 * sparirebbe dal grafico — i suoi numeri del mese restano invece visibili, in tono neutro perché lì
 * non c'è nessun avviso da dare.
 */
export function BloccoSenzaCluster({
  dati,
  titolo = "Senza cluster",
  descrizione = "Contatti che non rientrano in nessuno dei cluster configurati sopra (nessun tag o nessuna pipeline di cluster in GHL).",
  neutro = false,
}: {
  dati: GhlBreakdownTag;
  titolo?: string;
  descrizione?: string;
  neutro?: boolean;
}) {
  const stile = neutro ? STILE_LIVELLO.neutro : STILE_LIVELLO.attenzione;
  return (
    <div className={`rounded-xl border p-4 ${stile.classe}`}>
      <p className="text-xs font-semibold mb-1">{titolo}</p>
      <p className="text-[11px] mb-3 opacity-80">{descrizione}</p>
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
