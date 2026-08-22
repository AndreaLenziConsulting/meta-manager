"use client";

import { useEffect, useState } from "react";
import { RoadmapGantt } from "@/components/RoadmapGantt";
import { AttivitaLista } from "@/components/AttivitaLista";
import { Tabs } from "@/components/Tabs";
import type { StatoAttivita } from "@/types/kpi";
import type { GruppoFase } from "@/lib/roadmap";

type ClienteInfo = { clienteId: string; nome: string; prodottoId: string; dataInizioProgetto: string | null };
type Risposta = { cliente: ClienteInfo; gruppi: GruppoFase[] };
type Vista = "lista" | "gantt";

// Sentinella per "nessun filtro" — non può collidere con un vero valore di responsabile perché
// nessun campo testuale libero comincia per "__".
const RESPONSABILE_TUTTI = "__tutti__";

type Props = { clienteId: string; onVaiAMeeting?: (meetingId: string) => void };

export function AttivitaTab({ clienteId, onVaiAMeeting }: Props) {
  const [dati, setDati] = useState<Risposta | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [vista, setVista] = useState<Vista>("lista");
  const [responsabileFiltro, setResponsabileFiltro] = useState(RESPONSABILE_TUTTI);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        return fetch(`/api/attivita?clienteId=${encodeURIComponent(clienteId)}`, { signal: controller.signal });
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento della roadmap");
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
  }, [clienteId, refreshTick]);

  async function handleGeneraRoadmap() {
    setGenerando(true);
    setErrore(null);
    try {
      const res = await fetch("/api/attivita/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Generazione roadmap non riuscita");
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setGenerando(false);
    }
  }

  // Aggiornamento ottimistico: la UI cambia subito, si allinea davvero dopo la risposta; in caso
  // di errore torna allo stato precedente (stesso schema try/catch+rollback del refresh KPI).
  async function handleCambiaStato(attivitaId: string, nuovoStato: StatoAttivita, notaTeam?: string) {
    setDati((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gruppi: prev.gruppi.map((g) => ({
          ...g,
          attivita: g.attivita.map((a) =>
            a.attivitaId === attivitaId ? { ...a, stato: nuovoStato, notaTeam: notaTeam ?? a.notaTeam } : a
          ),
        })),
      };
    });

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
      setRefreshTick((t) => t + 1); // ricarica i dati veri dal server invece di tenere l'ottimistico non confermato
    }
  }

  // Stesso schema ottimistico di handleCambiaStato, per la data di scadenza (solo vista Lista).
  async function handleCambiaScadenza(attivitaId: string, nuovaDataFine: string) {
    setDati((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gruppi: prev.gruppi.map((g) => ({
          ...g,
          attivita: g.attivita.map((a) => (a.attivitaId === attivitaId ? { ...a, dataFine: nuovaDataFine } : a)),
        })),
      };
    });

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

  // Stesso schema ottimistico degli altri due (rimuove subito dalla UI, ripristina dal server in
  // caso di errore) — nessun soft-delete, la riga sparisce davvero dal foglio.
  async function handleEliminaAttivita(attivitaId: string) {
    setDati((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gruppi: prev.gruppi.map((g) => ({ ...g, attivita: g.attivita.filter((a) => a.attivitaId !== attivitaId) })),
      };
    });

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

  const haRoadmap = dati.gruppi.some((g) => g.attivita.length > 0);

  // Valori distinti già presenti nella roadmap del cliente (non un elenco fisso: "responsabile" è
  // testo libero — ruoli tipo "PM"/"CS" per i task da template, nomi veri per i task da meeting).
  const responsabiliDisponibili = Array.from(
    new Set(dati.gruppi.flatMap((g) => g.attivita.map((a) => a.responsabile)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const passaFiltro = (a: { responsabile: string }) =>
    responsabileFiltro === RESPONSABILE_TUTTI || a.responsabile === responsabileFiltro;
  const gruppiFiltrati = dati.gruppi
    .map((g) => ({ ...g, attivita: g.attivita.filter(passaFiltro) }))
    .filter((g) => g.attivita.length > 0);

  if (!haRoadmap) {
    const puoGenerare = !!(dati.cliente.prodottoId && dati.cliente.dataInizioProgetto);
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 sm:p-12 flex items-center justify-center min-h-[240px]">
        <div className="text-center max-w-sm">
          <h3 className="text-base font-semibold text-gray-900">Nessuna roadmap</h3>
          {puoGenerare ? (
            <>
              <p className="text-sm text-gray-500 mt-1.5">
                Il cliente ha un prodotto assegnato ma la roadmap non è ancora stata generata.
              </p>
              <button
                type="button"
                onClick={handleGeneraRoadmap}
                disabled={generando}
                className="mt-4 rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 transition"
              >
                {generando ? "Generazione…" : "Genera roadmap"}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-1.5">
              Assegna un prodotto e una data di inizio progetto a questo cliente (foglio Clienti, colonne
              prodotto_id/data_inizio_progetto) per generare la roadmap.
            </p>
          )}
          {errore && <p className="text-xs text-red-600 mt-3">{errore}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 bg-surface p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setVista("lista")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              vista === "lista" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setVista("gantt")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              vista === "gantt" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            Gantt
          </button>
        </div>

        {/* Solo se ha senso scegliere: con 0-1 responsabili distinti un filtro non filtrerebbe nulla. */}
        {responsabiliDisponibili.length > 1 && (
          <Tabs
            tabs={[{ id: RESPONSABILE_TUTTI, label: "Tutti" }, ...responsabiliDisponibili.map((r) => ({ id: r, label: r }))]}
            attivo={responsabileFiltro}
            onChange={setResponsabileFiltro}
          />
        )}
      </div>

      {vista === "lista" ? (
        <AttivitaLista
          attivita={gruppiFiltrati.flatMap((g) => g.attivita)}
          onCambiaStato={handleCambiaStato}
          onCambiaScadenza={handleCambiaScadenza}
          onElimina={handleEliminaAttivita}
          onVaiAMeeting={onVaiAMeeting}
        />
      ) : (
        <RoadmapGantt gruppi={gruppiFiltrati} onCambiaStato={handleCambiaStato} />
      )}
    </div>
  );
}
