"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Conferma "pesante" riservata all'eliminazione di un Cliente (cascata su 7 tab — sedi, attività,
 * meeting, connessioni GHL, fasi completate, risultati commerciali — mai reversibile) — richiede
 * di digitare il nome ESATTO del cliente prima di abilitare il bottone, pattern "GitHub-style"
 * deliberatamente più attritoso della conferma semplice (`ConfermaEliminazioneModal`, usata per
 * Sede/Prospect/Connessione GHL, dove la cascata è molto più piccola).
 */
export function ConfermaEliminazioneNomeModal({
  titolo,
  nomeDaConfermare,
  messaggio,
  onConferma,
  onClose,
}: {
  titolo: string;
  nomeDaConfermare: string;
  messaggio: ReactNode;
  onConferma: () => Promise<void>;
  onClose: () => void;
}) {
  const [testoDigitato, setTestoDigitato] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const puoConfermare = testoDigitato.trim() === nomeDaConfermare.trim();

  async function handleConferma() {
    if (!puoConfermare) return;
    setErrore(null);
    setEliminando(true);
    try {
      await onConferma();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setEliminando(false);
    }
  }

  return (
    <Modal title={titolo} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-ink-700">{messaggio}</div>
        <div>
          <label className="text-xs font-semibold text-ink-700 mb-1 block">
            Digita <span className="font-mono">{nomeDaConfermare}</span> per confermare
          </label>
          <Input value={testoDigitato} onChange={(e) => setTestoDigitato(e.target.value)} autoFocus />
        </div>
        {errore && <p className="text-xs text-red-600">{errore}</p>}
        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <Button type="button" variant="danger" onClick={handleConferma} disabled={eliminando || !puoConfermare}>
            {eliminando ? "Eliminazione…" : "Elimina cliente per sempre"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={eliminando}>
            Annulla
          </Button>
        </div>
      </div>
    </Modal>
  );
}
