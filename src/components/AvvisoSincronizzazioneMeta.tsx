import { CloudOff } from "lucide-react";
import type { ProblemaSincronizzazione } from "@/lib/sincronizzazioneMeta";
import { formatDataBreve, formatEuro } from "@/lib/format";

export type ProblemaSincronizzazioneVista = ProblemaSincronizzazione & {
  nomeCliente: string;
  // Nome della sede, mostrato solo quando il cliente ne ha più di una (altrimenti è rumore).
  nomeSede: string | null;
};

/**
 * Banner "Dati Meta non aggiornati" in cima alla pagina Clienti (01/10/2026) — vedi
 * lib/sincronizzazioneMeta.ts per quando una sede finisce qui e perché le cause sono distinte.
 * Nessun problema = nessun banner: un "tutto ok" in più sarebbe solo rumore accanto a
 * RiepilogoAllarmiAdmin. Componente server, nessuna interazione oltre ai link al cliente.
 *
 * Le spiegazioni comuni a più sedi (cosa fare quando la sincronizzazione non è riuscita, il rifiuto
 * identico di Meta su tutte le sedi) stanno una volta sola in cima; ogni riga porta solo il suo
 * dato — con un guasto generale le righe sono una quindicina, ripetere il testo le renderebbe
 * illeggibili.
 */
export function AvvisoSincronizzazioneMeta({ problemi }: { problemi: ProblemaSincronizzazioneVista[] }) {
  if (problemi.length === 0) return null;

  // Stesso identico rifiuto di Meta su più sedi = quasi certamente il token condiviso dell'app, non
  // un problema dei singoli account.
  const dettagliRifiuto = problemi.flatMap((p) => (p.causa === "accesso" ? [p.dettaglio] : []));
  const rifiutoComune = dettagliRifiuto.length >= 2 && new Set(dettagliRifiuto).size === 1 ? dettagliRifiuto[0] : null;
  const haSincronizzazioneFallita = problemi.some((p) => p.causa === "sincronizzazione");

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
      <div className="flex items-center gap-2.5">
        <CloudOff size={20} className="text-red-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-red-700">
          Dati Meta non aggiornati per {problemi.length === 1 ? "1 sede" : `${problemi.length} sedi`}
        </p>
      </div>
      {rifiutoComune && (
        <p className="text-xs text-ink-700 mt-2">
          Meta rifiuta le richieste dell&apos;app con lo stesso messaggio su {dettagliRifiuto.length} sedi: «{rifiutoComune}». Finché non
          viene risolto la sincronizzazione resta ferma. Se il messaggio parla di token scaduto o non valido, va generato un nuovo token
          e aggiornato su Vercel.
        </p>
      )}
      {haSincronizzazioneFallita && (
        <p className="text-xs text-ink-700 mt-2">
          Dove su Meta risulta spesa non arrivata in app, la sincronizzazione automatica non è andata a buon fine: apri il cliente e
          premi &quot;Aggiorna KPI&quot;. Se mancano più di 3 giorni usa &quot;Recupera storico campagne&quot; in Modifica cliente.
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {problemi.map((p) => (
          <li key={`${p.clienteId}|${p.sedeId}`} className="text-xs text-ink-700">
            <a href={`/dashboard/cliente/${p.clienteId}`} className="font-semibold text-ink-900 underline underline-offset-2">
              {p.nomeCliente}
            </a>
            {p.nomeSede ? ` · ${p.nomeSede}` : ""}
            {": "}
            {p.ultimoGiorno
              ? `dati fermi al ${formatDataBreve(p.ultimoGiorno)}, ${p.giorniSenzaDati} giorni fa.`
              : "nessun dato in app per le campagne attive."}{" "}
            {p.causa === "sincronizzazione"
              ? `Su Meta ${formatEuro(p.spesaNonSincronizzata)} di spesa non arrivati in app.`
              : p.causa === "non-verificato"
                ? "Meta non ha risposto alla verifica: ricarica la pagina per riprovare."
                : rifiutoComune
                  ? ""
                  : `Meta rifiuta la lettura di questo account: «${p.dettaglio}».`}
          </li>
        ))}
      </ul>
    </div>
  );
}
