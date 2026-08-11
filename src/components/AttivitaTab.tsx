"use client";

import { useEffect, useState } from "react";
import { RoadmapGantt } from "@/components/RoadmapGantt";
import type { StatoAttivita } from "@/types/kpi";
import type { GruppoFase } from "@/lib/roadmap";

type ClienteInfo = { clienteId: string; nome: string; prodottoId: string; dataInizioProgetto: string | null };
type Risposta = { cliente: ClienteInfo; gruppi: GruppoFase[] };

export function AttivitaTab({ clienteId }: { clienteId: string }) {
  const [dati, setDati] = useState<Risposta | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

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

  if (caricamento && !dati) return <p className="text-sm text-gray-500">Caricamento…</p>;
  if (errore && !dati) return <p className="text-sm text-red-600">{errore}</p>;
  if (!dati) return null;

  const haRoadmap = dati.gruppi.some((g) => g.attivita.length > 0);

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
      <RoadmapGantt gruppi={dati.gruppi} onCambiaStato={handleCambiaStato} />
    </div>
  );
}
