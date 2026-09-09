"use client";

import { useEffect } from "react";

/**
 * Mini-toast generico per un'azione distruttiva con annullamento posticipato (redesign Attività,
 * 08/09/2026) — sostituisce il popup "conferma-prima-di-eliminare" per il cestino di
 * AttivitaLista.tsx: la riga scompare subito, questo toast resta visibile per `durataMs`, e SOLO
 * se scade senza che l'utente clicchi "Annulla" il chiamante esegue davvero l'azione (mai
 * eliminare-e-poi-provare-a-ripristinare: più corretto, non richiede una route di ripristino che
 * non esiste). Nessuna libreria toast in app (verificato, zero precedenti) — deliberatamente non
 * un sistema globale con coda: un'istanza per azione in sospeso, il chiamante ne monta quante gliene
 * servono (vedi la Map in AttivitaLista.tsx per eliminazioni multiple in sospeso insieme).
 */
export function UndoToast({
  messaggio,
  onAnnulla,
  onScadenza,
  durataMs = 6000,
}: {
  messaggio: string;
  onAnnulla: () => void;
  onScadenza: () => void;
  durataMs?: number;
}) {
  useEffect(() => {
    const timeoutId = setTimeout(onScadenza, durataMs);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onScadenza/durataMs sono stabili per la vita del toast (il chiamante ne monta uno nuovo per ogni azione), un timer che si riavvia ad ogni render romperebbe la durata promessa.
  }, []);

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-ink-300 bg-ink-900 text-white shadow-lg px-4 py-3 text-sm"
    >
      <span>{messaggio}</span>
      <button
        type="button"
        onClick={onAnnulla}
        className="font-semibold text-brand-light hover:underline cursor-pointer flex-shrink-0"
      >
        Annulla
      </button>
    </div>
  );
}
