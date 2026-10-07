"use client";

import { useEffect, useState } from "react";
import { AttivitaLista } from "@/components/AttivitaLista";
import { ComboboxMultiSelect } from "@/components/ComboboxMultiSelect";
import { GruppoCollassabile } from "@/components/GruppoCollassabile";
import { NuovaAttivitaForm } from "@/components/NuovaAttivitaForm";
import { Tabs } from "@/components/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Nota } from "@/components/ui/Nota";
import { classificaAssegnatario, nomeCoincideConConsulente, taskOrfana } from "@/lib/assegnatari";
import { attivitaDaFareOra, attivitaInRitardo, GIORNI_FINESTRA_DA_FARE_ORA, raggruppaAttivitaPerCliente } from "@/lib/roadmap";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";

// Quali attività mostrare: "ora" (in ritardo o in scadenza entro una settimana), tutte le aperte,
// oppure tutte, fatte comprese.
type Ambito = "ora" | "aperte" | "tutte";
// Oltre questo numero di clienti in vista i gruppi partono chiusi: si legge l'elenco dei clienti
// con i loro conteggi e si apre solo quello che interessa.
const SOGLIA_CLIENTI_APERTI = 3;
const CLASSE_FILTRO_RAPIDO =
  "min-h-10 rounded-full border-2 px-4 text-sm font-semibold transition cursor-pointer aria-pressed:bg-brand aria-pressed:border-brand aria-pressed:text-white border-bordo-campo bg-surface-card text-ink-700 hover:border-brand";

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
 *
 * Vista predefinita (07/10/2026, audit UX): la pagina si apre su "Da fare ora" — attività non fatte
 * in ritardo o in scadenza entro una settimana — e, quando i clienti in vista sono più di tre, con
 * i gruppi per cliente chiusi: prima mostrava 240 attività tutte aperte, quasi 20.000 pixel di
 * pagina. "Tutte le aperte" e "Tutte" restano a un clic.
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
  const [ambito, setAmbito] = useState<Ambito>("ora");
  // Gruppi per cliente aperti o chiusi A MANO (clienteId -> aperto). Chi non è qui segue la regola
  // predefinita: aperti se i clienti in vista sono pochi o se c'è una ricerca in corso.
  const [aperturaGruppi, setAperturaGruppi] = useState<Map<string, boolean>>(new Map());

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

  if (caricamento && !dati)
    return (
      <p role="status" className="text-sm text-ink-500">
        Caricamento…
      </p>
    );
  if (errore && !dati)
    return (
      <Nota tono="critico" etichetta="Attività non caricate" role="alert">
        <p>{errore}</p>
      </Nota>
    );
  if (!dati) return null;

  if (dati.clienti.length === 0) {
    return (
      <Nota etichetta="Nessun cliente">
        <p>Non hai ancora clienti assegnati.</p>
      </Nota>
    );
  }

  if (dati.attivita.length === 0) {
    return (
      <Nota etichetta="Nessuna attività">
        <p>Apri la scheda di un cliente per generare la sua roadmap, oppure aggiungi un&apos;attività da qui.</p>
      </Nota>
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
  // Filtra la stringa vuota (fase ora opzionale, richiesta utente 18/09/2026): mai un suggerimento
  // vuoto e cliccabile nella tendina di SelettoreFase.
  const fasiDisponibili = Array.from(new Set(dati.attivita.map((a) => a.fase).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const passaFiltro = (a: AttivitaClienteRow) =>
    (clientiFiltro === null || clientiFiltro.has(a.clienteId)) &&
    (responsabiliFiltro === null || a.assegnatari.some((x) => responsabiliFiltro.has(x))) &&
    (!soloOrfane || taskOrfana(a.assegnatari)) &&
    (!soloMie || Boolean(nomeConsulenteCorrente && a.assegnatari.some((x) => nomeCoincideConConsulente(x, nomeConsulenteCorrente)))) &&
    (!ricerca.trim() || a.descrizione.toLowerCase().includes(ricerca.trim().toLowerCase()));
  // Prima i filtri (cliente, assegnatario, ricerca), poi l'ambito: i conteggi sulle tre schede
  // dicono quante attività ci sono in ciascuna con i filtri già applicati.
  const conFiltri = dati.attivita.filter(passaFiltro);
  const perAmbito: Record<Ambito, AttivitaClienteRow[]> = {
    ora: conFiltri.filter((a) => attivitaDaFareOra(a)),
    aperte: conFiltri.filter((a) => a.stato !== "done"),
    tutte: conFiltri,
  };
  const attivitaFiltrata = perAmbito[ambito];

  // Raggruppamento per cliente quando il filtro ne lascia visibili più di uno (non solo il caso
  // letterale "tutti i clienti" — la stessa lettura vale con 2+ clienti scelti a mano): con un
  // solo cliente in vista il badge cliente su ogni riga (già in AttivitaLista) basta da solo.
  const perCliente = raggruppaAttivitaPerCliente(attivitaFiltrata);
  const clientiOrdinati = Array.from(perCliente.keys()).sort((a, b) =>
    (nomeClientePer.get(a) ?? a).localeCompare(nomeClientePer.get(b) ?? b)
  );
  const raggruppaPerCliente = clientiOrdinati.length > 1;
  const apertiDiDefault = clientiOrdinati.length <= SOGLIA_CLIENTI_APERTI || ricerca.trim() !== "";
  const gruppoAperto = (clienteId: string) => aperturaGruppi.get(clienteId) ?? apertiDiDefault;
  const tuttiAperti = clientiOrdinati.every(gruppoAperto);

  return (
    <div className="space-y-4">
      {errore && (
        <Nota tono="critico" etichetta="Modifica non salvata" role="alert">
          <p>{errore}</p>
        </Nota>
      )}

      <NuovaAttivitaForm
        clienti={dati.clienti}
        fasiDisponibili={fasiDisponibili}
        consulenti={consulenti}
        onCreata={() => setRefreshTick((t) => t + 1)}
      />

      <Tabs
        etichetta="Quali attività mostrare"
        tabs={[
          { id: "ora", label: `Da fare ora (${perAmbito.ora.length})` },
          { id: "aperte", label: `Tutte le aperte (${perAmbito.aperte.length})` },
          { id: "tutte", label: `Tutte (${perAmbito.tutte.length})` },
        ]}
        attivo={ambito}
        onChange={(id) => setAmbito(id === "aperte" ? "aperte" : id === "tutte" ? "tutte" : "ora")}
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
            etichettaTutti="Tutti gli assegnatari"
            nomePlurale="assegnatari"
            opzioni={responsabiliDisponibili}
            selezionati={responsabiliFiltro}
            onChange={setResponsabiliFiltro}
            ricercabile
          />
        )}
        <button type="button" aria-pressed={soloOrfane} onClick={() => setSoloOrfane((v) => !v)} className={CLASSE_FILTRO_RAPIDO}>
          Da assegnare
        </button>
        {nomeConsulenteCorrente && (
          <button type="button" aria-pressed={soloMie} onClick={() => setSoloMie((v) => !v)} className={CLASSE_FILTRO_RAPIDO}>
            Le mie task
          </button>
        )}
        <Input
          type="search"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca task…"
          aria-label="Cerca nelle attività"
          className="w-56 min-h-10 py-2"
        />
        {raggruppaPerCliente && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setAperturaGruppi(new Map(clientiOrdinati.map((id) => [id, !tuttiAperti])))}
          >
            {tuttiAperti ? "Chiudi tutti i clienti" : "Apri tutti i clienti"}
          </Button>
        )}
      </div>

      {attivitaFiltrata.length === 0 ? (
        ambito === "ora" && conFiltri.length > 0 ? (
          <Nota tono="ok" etichetta="Niente da fare ora">
            <p>
              Nessuna attività in ritardo né in scadenza nei prossimi {GIORNI_FINESTRA_DA_FARE_ORA} giorni. Le altre le trovi in &quot;Tutte le
              aperte&quot;.
            </p>
          </Nota>
        ) : (
          <Nota etichetta="Nessun risultato">
            <p>Nessuna attività corrisponde ai filtri scelti.</p>
          </Nota>
        )
      ) : raggruppaPerCliente ? (
        <div className="space-y-2">
          {clientiOrdinati.map((clienteId) => {
            const righeCliente = perCliente.get(clienteId) ?? [];
            const inRitardo = attivitaInRitardo(righeCliente).length;
            const aperto = gruppoAperto(clienteId);
            return (
              <GruppoCollassabile
                key={clienteId}
                aperto={aperto}
                onToggle={() => setAperturaGruppi((prev) => new Map(prev).set(clienteId, !aperto))}
                headerClassName={`px-4 rounded-xl border border-linea bg-surface-card text-ink-500 hover:border-brand transition-colors ${aperto ? "mb-3" : ""}`}
                titolo={
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="text-base font-bold text-ink-900 truncate">{nomeClientePer.get(clienteId) ?? clienteId}</span>
                    <span className="text-xs font-medium text-ink-500">
                      {righeCliente.length} attività
                    </span>
                    {inRitardo > 0 && <Badge tono="critico">{inRitardo} in ritardo</Badge>}
                  </span>
                }
              >
                <div className="mb-5">
                  <AttivitaLista
                    attivita={righeCliente}
                    onCambiaStato={handleCambiaStato}
                    onCambiaScadenza={handleCambiaScadenza}
                    onCambiaAssegnatari={handleCambiaAssegnatari}
                    onElimina={handleEliminaAttivita}
                    consulenti={consulenti}
                  />
                </div>
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
