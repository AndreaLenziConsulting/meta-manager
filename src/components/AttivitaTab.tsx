"use client";

import { useEffect, useState } from "react";
import { RoadmapGantt } from "@/components/RoadmapGantt";
import { AttivitaLista } from "@/components/AttivitaLista";
import { ComboboxMultiSelect } from "@/components/ComboboxMultiSelect";
import { NuovaAttivitaForm } from "@/components/NuovaAttivitaForm";
import { FaseCompletataBanner } from "@/components/FaseCompletataBanner";
import { classificaAssegnatario, nomeCoincideConConsulente, taskOrfana } from "@/lib/assegnatari";
import type { StatoAttivita } from "@/types/kpi";
import type { GruppoFase } from "@/lib/roadmap";

type ClienteInfo = { clienteId: string; nome: string; prodottoId: string; dataInizioProgetto: string | null };
type Risposta = { cliente: ClienteInfo; gruppi: GruppoFase[] };
type Vista = "lista" | "gantt";

type Props = {
  clienteId: string;
  onVaiAMeeting?: (meetingId: string) => void;
  // Identità note per il popover di editing assegnatari in AttivitaLista.tsx — vedi il commento lì.
  consulenti?: { consulenteId: string; nome: string }[];
  // Nome del consulente della sessione corrente, per il quick-filter "Le mie task" — vedi lo
  // stesso prop in AttivitaGlobali.tsx.
  nomeConsulenteCorrente?: string;
};

export function AttivitaTab({ clienteId, onVaiAMeeting, consulenti = [], nomeConsulenteCorrente }: Props) {
  const [dati, setDati] = useState<Risposta | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [vista, setVista] = useState<Vista>("lista");
  // null = tutti — stesso contratto di ComboboxMultiSelect/CampagneFilter.
  const [responsabiliFiltro, setResponsabiliFiltro] = useState<Set<string> | null>(null);
  const [soloOrfane, setSoloOrfane] = useState(false);
  const [soloMie, setSoloMie] = useState(false);
  // Banner "tappa raggiunta" (vista milestone, Fase 1 roadmap) — vedi FaseCompletataBanner.tsx.
  // Fetch separato dalla roadmap sopra: /api/fasi-completate risponde solo fase+data, non l'intera
  // roadmap. fasiTick (a parte da refreshTick) si incrementa solo dopo un cambio di stato RIUSCITO
  // (vedi handleCambiaStato sotto) — un fallimento non può aver completato nessuna fase davvero.
  const [fasiCompletate, setFasiCompletate] = useState<{ fase: string; completataIl: string }[]>([]);
  const [fasiTick, setFasiTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/fasi-completate?clienteId=${encodeURIComponent(clienteId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { fasi: { fase: string; completataIl: string }[] } | null) => setFasiCompletate(body?.fasi ?? []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [clienteId, fasiTick]);

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
      // Questo salvataggio potrebbe aver appena completato una fase (vedi POST /api/attivita/stato,
      // che lo rileva e lo registra da sé) — ricarica il banner per mostrarlo senza refresh manuale.
      setFasiTick((t) => t + 1);
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

  // Stesso schema ottimistico di handleCambiaScadenza sopra, per gli assegnatari.
  async function handleCambiaAssegnatari(attivitaId: string, assegnatari: string[]) {
    setDati((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gruppi: prev.gruppi.map((g) => ({
          ...g,
          attivita: g.attivita.map((a) => (a.attivitaId === attivitaId ? { ...a, assegnatari } : a)),
        })),
      };
    });

    try {
      const res = await fetch("/api/attivita/assegnatari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, attivitaId, assegnatari }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Aggiornamento assegnatari non riuscito");
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

  if (caricamento && !dati) return <p className="text-sm text-ink-500">Caricamento…</p>;
  if (errore && !dati) return <p className="text-sm text-red-600">{errore}</p>;
  if (!dati) return null;

  const haRoadmap = dati.gruppi.some((g) => g.attivita.length > 0);

  // Valori distinti già presenti nella roadmap del cliente (non un elenco fisso: "assegnatari" è
  // testo libero normalizzato — ruoli tipo "Project Manager"/"Consulente Senior" per i task da
  // template, nomi veri per i task da meeting, vedi src/lib/assegnatari.ts). "Da assegnare"
  // escluso: è il quick-filter "Da assegnare" sotto, non un'opzione della combobox.
  const responsabiliDisponibili = Array.from(new Set(dati.gruppi.flatMap((g) => g.attivita.flatMap((a) => a.assegnatari))))
    .filter((nome) => classificaAssegnatario(nome) !== "non-assegnato")
    .map((nome) => ({ id: nome, label: nome, gruppo: classificaAssegnatario(nome) === "persona" ? "Persone" : "Ruoli" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Stesso schema, per l'autocomplete di NuovaAttivitaForm sotto: un'attività aggiunta a mano finisce
  // più spesso in una fase già in corso che in una nuova lane dedicata (mai un elenco fisso: "fase"
  // è testo libero, ogni cliente ha le proprie).
  const fasiDisponibili = Array.from(new Set(dati.gruppi.map((g) => g.fase))).sort((a, b) => a.localeCompare(b));
  const passaFiltro = (a: { assegnatari: string[] }) =>
    (responsabiliFiltro === null || a.assegnatari.some((x) => responsabiliFiltro.has(x))) &&
    (!soloOrfane || taskOrfana(a.assegnatari)) &&
    (!soloMie || Boolean(nomeConsulenteCorrente && a.assegnatari.some((x) => nomeCoincideConConsulente(x, nomeConsulenteCorrente))));
  const gruppiFiltrati = dati.gruppi
    .map((g) => ({ ...g, attivita: g.attivita.filter(passaFiltro) }))
    .filter((g) => g.attivita.length > 0);

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      <FaseCompletataBanner fasi={fasiCompletate} />

      <NuovaAttivitaForm
        clienteId={clienteId}
        fasiDisponibili={fasiDisponibili}
        consulenti={consulenti}
        onCreata={() => setRefreshTick((t) => t + 1)}
      />

      {!haRoadmap ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 sm:p-12 flex items-center justify-center min-h-[240px]">
          <div className="text-center max-w-sm">
            <h3 className="text-base font-semibold text-ink-900">Nessuna roadmap</h3>
            {dati.cliente.prodottoId && dati.cliente.dataInizioProgetto ? (
              <>
                <p className="text-sm text-ink-500 mt-1.5">
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
              <p className="text-sm text-ink-500 mt-1.5">
                Assegna un prodotto e una data di inizio progetto a questo cliente (foglio Clienti, colonne
                prodotto_id/data_inizio_progetto) per generare la roadmap da un template — oppure aggiungi la prima
                attività a mano dal pulsante sopra.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
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

            <div className="flex flex-wrap items-center gap-2">
              {/* Solo se ha senso scegliere: con 0-1 responsabili distinti un filtro non filtrerebbe nulla. */}
              {responsabiliDisponibili.length > 1 && (
                <ComboboxMultiSelect
                  etichettaTutti="Tutti"
                  nomePlurale="assegnatari"
                  opzioni={responsabiliDisponibili}
                  selezionati={responsabiliFiltro}
                  onChange={setResponsabiliFiltro}
                  ricercabile
                />
              )}
              <button
                type="button"
                onClick={() => setSoloOrfane((v) => !v)}
                className={`text-xs font-semibold px-3 py-2 rounded-xl border transition cursor-pointer ${
                  soloOrfane ? "bg-brand text-white border-brand" : "bg-surface-card text-ink-700 border-ink-300 hover:border-brand/40"
                }`}
              >
                Da assegnare
              </button>
              {nomeConsulenteCorrente && (
                <button
                  type="button"
                  onClick={() => setSoloMie((v) => !v)}
                  className={`text-xs font-semibold px-3 py-2 rounded-xl border transition cursor-pointer ${
                    soloMie ? "bg-brand text-white border-brand" : "bg-surface-card text-ink-700 border-ink-300 hover:border-brand/40"
                  }`}
                >
                  Le mie task
                </button>
              )}
            </div>
          </div>

          {vista === "lista" ? (
            <AttivitaLista
              attivita={gruppiFiltrati.flatMap((g) => g.attivita)}
              onCambiaStato={handleCambiaStato}
              onCambiaScadenza={handleCambiaScadenza}
              onCambiaAssegnatari={handleCambiaAssegnatari}
              onElimina={handleEliminaAttivita}
              onVaiAMeeting={onVaiAMeeting}
              consulenti={consulenti}
            />
          ) : (
            <RoadmapGantt gruppi={gruppiFiltrati} onCambiaStato={handleCambiaStato} />
          )}
        </>
      )}
    </div>
  );
}
