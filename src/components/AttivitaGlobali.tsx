"use client";

import { useEffect, useState } from "react";
import { AttivitaLista } from "@/components/AttivitaLista";
import { ComboboxMultiSelect } from "@/components/ComboboxMultiSelect";
import { GruppoCollassabile } from "@/components/GruppoCollassabile";
import { NuovaAttivitaForm } from "@/components/NuovaAttivitaForm";
import { classificaAssegnatario, nomeCoincideConConsulente, taskOrfana } from "@/lib/assegnatari";
import { raggruppaAttivitaPerCliente } from "@/lib/roadmap";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";

type ClienteRef = { clienteId: string; nome: string };
type Risposta = { clienti: ClienteRef[]; attivita: AttivitaClienteRow[] };

type Props = {
  // Identità note per il popover di editing assegnatari in AttivitaLista.tsx — vedi il commento lì.
  consulenti?: { consulenteId: string; nome: string }[];
  // Nome del consulente della sessione corrente, per il quick-filter "Le mie task" — assente per
  // l'admin (nessuna identità "propria" in questo modello, vedi authz.ts) o se non risolvibile.
  nomeConsulenteCorrente?: string;
};

/**
 * Vista aggregata "Attività" — tutte le attività di tutti i clienti visibili alla sessione
 * (tutti per l'admin, solo i propri per il consulente), mescolate per stato esattamente come la
 * vista Lista per-cliente già esistente (AttivitaLista.tsx, riusata as-is con in più il badge
 * nome-cliente su ogni riga, sostituito da un vero raggruppamento per cliente quando il filtro ne
 * lascia visibili più di uno — vedi sotto). Nessuna vista Gantt: qui serve "cosa devo fare su
 * tutto", non la timeline di progetto di un singolo cliente.
 *
 * Redesign UX 08/09/2026 (critica strutturata dell'utente): i due filtri a riga di `Tabs` (chip di
 * altezza diversa, quella responsabili tagliata a destra, mescolava persone/ruoli/combinazioni/
 * "Da assegnare") diventano due ComboboxMultiSelect con ricerca; "Da assegnare" non è più
 * un'opzione del filtro Responsabile ma un quick-filter a parte (taskOrfana, src/lib/assegnatari.ts);
 * "Le mie task" è un secondo quick-filter, visibile solo se la sessione ha un'identità risolvibile;
 * una ricerca testuale sulla descrizione (il problema di scala, 66 righe, è qui — non nel tab
 * per-cliente, dove non l'ho aggiunta per non introdurre uno scope non richiesto).
 *
 * Stessa architettura fetch/ottimistico/rollback di AttivitaTab.tsx, ma più piatta (niente
 * `gruppi` per fase/Gantt) — e con una differenza cruciale: lì `clienteId` è un prop fisso del
 * componente, qui ogni riga può appartenere a un cliente diverso, quindi ogni handler deve
 * ricavare il `clienteId` dalla riga stessa (mai da un filtro selezionato) prima di chiamare le
 * stesse route di mutazione già usate da AttivitaTab (generiche, prendono clienteId a body).
 */
export function AttivitaGlobali({ consulenti = [], nomeConsulenteCorrente }: Props = {}) {
  const [dati, setDati] = useState<Risposta | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // null = tutti/e — stesso contratto di ComboboxMultiSelect/CampagneFilter.
  const [responsabiliFiltro, setResponsabiliFiltro] = useState<Set<string> | null>(null);
  const [clientiFiltro, setClientiFiltro] = useState<Set<string> | null>(null);
  const [soloOrfane, setSoloOrfane] = useState(false);
  const [soloMie, setSoloMie] = useState(false);
  const [ricerca, setRicerca] = useState("");

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

  // Stesso schema ottimistico di handleCambiaScadenza sopra, per gli assegnatari.
  async function handleCambiaAssegnatari(attivitaId: string, assegnatari: string[]) {
    const riga = dati?.attivita.find((a) => a.attivitaId === attivitaId);
    if (!riga) return;
    const { clienteId } = riga;

    setDati((prev) =>
      prev && {
        ...prev,
        attivita: prev.attivita.map((a) => (a.attivitaId === attivitaId ? { ...a, assegnatari } : a)),
      }
    );

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

  // Come prima del redesign: valori distinti calcolati sul set NON filtrato, così scegliere un
  // filtro non fa sparire le opzioni dell'altro. "Da assegnare" escluso: è il quick-filter sotto,
  // non un'opzione della combobox — evita di doverlo scorrere via ricerca ogni volta.
  const responsabiliDisponibili = Array.from(new Set(dati.attivita.flatMap((a) => a.assegnatari)))
    .filter((nome) => classificaAssegnatario(nome) !== "non-assegnato")
    .map((nome) => ({ id: nome, label: nome, gruppo: classificaAssegnatario(nome) === "persona" ? "Persone" : "Ruoli" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const clientiDisponibili = Array.from(new Set(dati.attivita.map((a) => a.clienteId)))
    .map((clienteId) => ({ id: clienteId, label: nomeClientePer.get(clienteId) ?? clienteId }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Stesso schema di AttivitaTab.tsx, per l'autocomplete di NuovaAttivitaForm sotto — qui però su
  // tutte le fasi di tutti i clienti visibili, non solo di uno: coerente col fatto che qui si scelga
  // anche il cliente.
  const fasiDisponibili = Array.from(new Set(dati.attivita.map((a) => a.fase))).sort((a, b) => a.localeCompare(b));

  const passaFiltro = (a: AttivitaClienteRow) =>
    (clientiFiltro === null || clientiFiltro.has(a.clienteId)) &&
    (responsabiliFiltro === null || a.assegnatari.some((x) => responsabiliFiltro.has(x))) &&
    (!soloOrfane || taskOrfana(a.assegnatari)) &&
    (!soloMie || Boolean(nomeConsulenteCorrente && a.assegnatari.some((x) => nomeCoincideConConsulente(x, nomeConsulenteCorrente)))) &&
    (!ricerca.trim() || a.descrizione.toLowerCase().includes(ricerca.trim().toLowerCase()));
  const attivitaFiltrata = dati.attivita.filter(passaFiltro);

  // Raggruppamento per cliente quando il filtro ne lascia visibili più di uno (non solo il caso
  // letterale "tutti i clienti" — la stessa lettura vale con 2+ clienti scelti a mano): con un
  // solo cliente in vista il badge cliente su ogni riga (già in AttivitaLista) basta da solo.
  const perCliente = raggruppaAttivitaPerCliente(attivitaFiltrata);
  const clientiOrdinati = Array.from(perCliente.keys()).sort((a, b) =>
    (nomeClientePer.get(a) ?? a).localeCompare(nomeClientePer.get(b) ?? b)
  );
  const raggruppaPerCliente = clientiOrdinati.length > 1;

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      <NuovaAttivitaForm
        clienti={dati.clienti}
        fasiDisponibili={fasiDisponibili}
        consulenti={consulenti}
        onCreata={() => setRefreshTick((t) => t + 1)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {clientiDisponibili.length > 1 && (
          <ComboboxMultiSelect
            etichettaTutti="Tutti i clienti"
            nomePlurale="clienti"
            opzioni={clientiDisponibili}
            selezionati={clientiFiltro}
            onChange={setClientiFiltro}
            ricercabile
          />
        )}
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
        <input
          type="text"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca task…"
          className="rounded-xl border border-ink-300 bg-surface-card px-3 py-2 text-sm text-ink-900 shadow-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition w-48"
        />
      </div>

      {attivitaFiltrata.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessuna attività corrisponde ai filtri.</p>
        </div>
      ) : raggruppaPerCliente ? (
        <div className="space-y-3">
          {clientiOrdinati.map((clienteId) => {
            const righeCliente = perCliente.get(clienteId) ?? [];
            return (
              <GruppoCollassabile
                key={clienteId}
                headerClassName="px-1 py-1.5"
                titolo={
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900">{nomeClientePer.get(clienteId) ?? clienteId}</span>
                    <span className="text-xs text-ink-500">{righeCliente.length}</span>
                  </span>
                }
              >
                <AttivitaLista
                  attivita={righeCliente}
                  onCambiaStato={handleCambiaStato}
                  onCambiaScadenza={handleCambiaScadenza}
                  onCambiaAssegnatari={handleCambiaAssegnatari}
                  onElimina={handleEliminaAttivita}
                  consulenti={consulenti}
                />
              </GruppoCollassabile>
            );
          })}
        </div>
      ) : (
        <AttivitaLista
          attivita={attivitaFiltrata}
          onCambiaStato={handleCambiaStato}
          onCambiaScadenza={handleCambiaScadenza}
          onCambiaAssegnatari={handleCambiaAssegnatari}
          onElimina={handleEliminaAttivita}
          nomeClientePer={nomeClientePer}
          consulenti={consulenti}
        />
      )}
    </div>
  );
}
