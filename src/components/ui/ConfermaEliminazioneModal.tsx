"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Conferma "semplice" prima di un'eliminazione admin-only (Sede/Prospect/Connessione GHL, vedi
 * piano eliminazione 09/09/2026) — un sì/no con messaggio esplicito sulla cascata coinvolta, mai
 * `window.confirm` (nessun precedente in app: sempre componenti custom sopra `Modal`/`Button`). Per
 * il Cliente (cascata su 7 tab, molto più pesante) c'è invece `ConfermaEliminazioneNomeModal`, che
 * richiede di digitare il nome — qui basta un click sul bottone rosso.
 */
export function ConfermaEliminazioneModal({
  titolo,
  messaggio,
  labelConferma = "Elimina",
  onConferma,
  onClose,
}: {
  titolo: string;
  messaggio: ReactNode;
  labelConferma?: string;
  onConferma: () => Promise<void>;
  onClose: () => void;
}) {
  const [eliminando, setEliminando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleConferma() {
    setErrore(null);
    setEliminando(true);
    try {
      await onConferma();
      // Nessun reset di eliminando qui: il successo chiude il modale dal chiamante (onConferma
      // tipicamente fa anche onClose/router.refresh) — se per qualche motivo non lo fa, restare
      // "in corso" è comunque meno confuso che riabilitare un bottone che ha già agito.
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setEliminando(false);
    }
  }

  return (
    <Modal title={titolo} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-ink-700">{messaggio}</div>
        {errore && <p className="text-xs text-red-600">{errore}</p>}
        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <Button type="button" variant="danger" onClick={handleConferma} disabled={eliminando}>
            {eliminando ? "Eliminazione…" : labelConferma}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={eliminando}>
            Annulla
          </Button>
        </div>
      </div>
    </Modal>
  );
}
