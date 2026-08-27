"use client";

import { useEffect, useState } from "react";
import { AttivitaLista } from "@/components/AttivitaLista";
import { Tabs } from "@/components/Tabs";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";

// Sentinelle per "nessun filtro" — stesso schema di AttivitaTab.tsx (RESPONSABILE_TUTTI): nessun
// campo testuale libero o clienteId reale comincia per "__".
const RESPONSABILE_TUTTI = "__tutti__";
const CLIENTE_TUTTI = "__tutti__";

type ClienteRef = { clienteId: string; nome: string };
type Risposta = { clienti: ClienteRef[]; attivita: AttivitaClienteRow[] };

/**
 * Vista aggregata "Attività" — tutte le attività di tutti i clienti visibili alla sessione
 * (tutti per l'admin, solo i propri per il consulente), mescolate per stato esattamente come la
 * vista Lista per-cliente già esistente (AttivitaLista.tsx, riusata as-is con in più il badge
 * nome-cliente su ogni riga). Nessun raggruppamento per cliente, nessuna vista Gantt: qui serve
 * "cosa devo fare su tutto", non la timeline di progetto di un singolo cliente.
 *
 * Stessa architettura fetch/ottimistico/rollback di AttivitaTab.tsx, ma più piatta (niente
 * `gruppi` per fase/Gantt) — e con una differenza cruciale: lì `clienteId` è un prop fisso del
 * componente, qui ogni riga può appartenere a un cliente diverso, quindi ogni handler deve
 * ricavare il `clienteId` dalla riga stessa (mai da un filtro selezionato) prima di chiamare le
 * stesse tre route di mutazione già usate da AttivitaTab (generiche, prendono clienteId a body).
 */
export function AttivitaGlobali() {
  const [dati, setDati] = useState<Risposta | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [responsabileFiltro, setResponsabileFiltro] = useState(RESPONSABILE_TUTTI);
  const [clienteFiltro, setClienteFiltro] = useState(CLIENTE_TUTTI);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        return fetch("/api/attivita/tutte", { signal: controller.signal });
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento delle attività");
        }
        return res.json();
      })
      .then((data: Risposta) => setDati(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err.message);
      })
      .finally(() => setCaricamento(false));

    return () => controller.abort();
  }, [refreshTick]);

  async function handleCambiaStato(attivitaId: string, nuovoStato: StatoAttivita, notaTeam?: string) {
    const riga = dati?.attivita.find((a) => a.attivitaId === attivitaId);
    if (!riga) return;
    const { clienteId } = riga;

    setDati((prev) =>
      prev && {
        ...prev,
        attivita: prev.attivita.map((a) =>
          a.attivitaId === attivitaId ? { ...a, stato: nuovoStato, notaTeam: notaTeam ?? a.notaTeam } : a
        ),
      }
    );

    try {
      const res = await fetch("/api/attivita/stato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, attivitaId, stato: nuovoStato, notaTeam }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Aggiornamento stato non riuscito");
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setRefreshTick((t) => t + 1);
    }
  }

  async function handleCambiaScadenza(attivitaId: string, nuovaDataFine: string) {
    const riga = dati?.attivita.find((a) => a.attivitaId === attivitaId);
    if (!riga) return;
    const { clienteId } = riga;

    setDati((prev) =>
      prev && {
        ...prev,
        attivita: prev.attivita.map((a) => (a.attivitaId === attivitaId ? { ...a, dataFine: nuovaDataFine } : a)),
      }
    );

    try {
      const res = await fetch("/api/attivita/scadenza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, attivitaId, dataFine: nuovaDataFine }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Aggiornamento scadenza non riuscito");
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setRefreshTick((t) => t + 1);
    }
  }

  async function handleEliminaAttivita(attivitaId: string) {
    const riga = dati?.attivita.find((a) => a.attivitaId === attivitaId);
    if (!riga) return;
    const { clienteId } = riga;

    setDati((prev) => prev && { ...prev, attivita: prev.attivita.filter((a) => a.attivitaId !== attivitaId) });

    try {
      const res = await fetch("/api/attivita/elimina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, attivitaId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Eliminazione non riuscita");
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setRefreshTick((t) => t + 1);
    }
  }

  if (caricamento && !dati) return <p className="text-sm text-gray-500">Caricamento…</p>;
  if (errore && !dati) return <p className="text-sm text-red-600">{errore}</p>;
  if (!dati) return null;

  if (dati.clienti.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
        <p className="text-sm text-ink-500">Nessun cliente assegnato.</p>
      </div>
    );
  }

  if (dati.attivita.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
        <p className="text-sm text-ink-500">
          Nessuna attività. Apri la scheda di un cliente per generare la sua roadmap.
        </p>
      </div>
    );
  }

  const nomeClientePer = new Map(dati.clienti.map((c) => [c.clienteId, c.nome]));

  // Come in AttivitaTab.tsx: valori distinti calcolati sul set NON filtrato, così scegliere un
  // filtro non fa sparire le opzioni dell'altro.
  const responsabiliDisponibili = Array.from(new Set(dati.attivita.map((a) => a.responsabile).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );
  const clientiDisponibili = Array.from(new Set(dati.attivita.map((a) => a.clienteId)))
    .map((clienteId) => ({ clienteId, nome: nomeClientePer.get(clienteId) ?? clienteId }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const passaFiltro = (a: AttivitaClienteRow) =>
    (clienteFiltro === CLIENTE_TUTTI || a.clienteId === clienteFiltro) &&
    (responsabileFiltro === RESPONSABILE_TUTTI || a.responsabile === responsabileFiltro);
  const attivitaFiltrata = dati.attivita.filter(passaFiltro);

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {(clientiDisponibili.length > 1 || responsabiliDisponibili.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          {clientiDisponibili.length > 1 && (
            <Tabs
              tabs={[{ id: CLIENTE_TUTTI, label: "Tutti i clienti" }, ...clientiDisponibili.map((c) => ({ id: c.clienteId, label: c.nome }))]}
              attivo={clienteFiltro}
              onChange={setClienteFiltro}
            />
          )}
          {responsabiliDisponibili.length > 1 && (
            <Tabs
              tabs={[{ id: RESPONSABILE_TUTTI, label: "Tutti" }, ...responsabiliDisponibili.map((r) => ({ id: r, label: r }))]}
              attivo={responsabileFiltro}
              onChange={setResponsabileFiltro}
            />
          )}
        </div>
      )}

      <AttivitaLista
        attivita={attivitaFiltrata}
        onCambiaStato={handleCambiaStato}
        onCambiaScadenza={handleCambiaScadenza}
        onElimina={handleEliminaAttivita}
        nomeClientePer={nomeClientePer}
      />
    </div>
  );
}
