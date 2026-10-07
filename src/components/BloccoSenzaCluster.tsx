import { formatEuro, formatNumero } from "@/lib/format";
import { Nota } from "@/components/ui/Nota";
import type { GhlBreakdownTag } from "@/types/ghl";

/**
 * Quarto blocco accanto ai blocchi per categoria in PacingTargetChart.tsx (20/09/2026, segnalato
 * dall'utente: i totali di sede non coincidevano con la somma dei blocchi per categoria — 3 dei 5
 * appuntamenti del mese appartenevano a contatti senza nessun tag cluster). Deliberatamente SENZA
 * target/meter/stato di pacing (a differenza di BloccoPacing): "senza cluster" non è un obiettivo da
 * raggiungere, è un gap di tagging in GHL da chiudere — mostra solo i conteggi attuali, per non far
 * sparire in silenzio numeri che il totale sede include ma nessun cluster cattura. Nota in tono
 * "attenzione" per lo stesso motivo: un avviso operativo, non un dato negativo.
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
  return (
    <Nota tono={neutro ? "accento" : "attenzione"} etichetta={titolo} compatta>
      <p className="text-xs leading-4">{descrizione}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        <RigaConteggio etichetta="Richieste" valore={formatNumero(dati.richieste)} />
        <RigaConteggio etichetta="Appuntamenti" valore={formatNumero(dati.appuntamenti.totali)} />
        <RigaConteggio etichetta="Vendite" valore={formatNumero(dati.opportunita.vendite)} />
        <RigaConteggio etichetta="Fatturato" valore={formatEuro(dati.opportunita.fatturato)} />
      </dl>
    </Nota>
  );
}

function RigaConteggio({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-500">{etichetta}</dt>
      <dd className="font-bold tabular-nums text-ink-900">{valore}</dd>
    </div>
  );
}
