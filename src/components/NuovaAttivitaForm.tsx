"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { oggiIso } from "@/lib/roadmap";
import { formatDataRelativa } from "@/lib/format";
import { ETICHETTA_CLIENTE, RUOLI_INTERNI, SENTINELLA_NON_ASSEGNATO } from "@/lib/assegnatari";

const inputClass =
  "w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";
const labelClass = "text-xs font-semibold text-ink-700 mb-1 block";

type Props = {
  // Assente SOLO nella vista aggregata (AttivitaGlobali.tsx): il form mostra prima un select
  // cliente (richiede `clienti`) prima degli stessi campi già usati nel tab per-cliente
  // (AttivitaTab.tsx, dove clienteId è già il contesto della pagina e non serve scegliere).
  clienteId?: string;
  clienti?: { clienteId: string; nome: string }[];
  fasiDisponibili: string[];
  // Identità note per la selezione assegnatari — stesso set di AttivitaLista.tsx (consulenti reali
  // + i 2 ruoli interni + "Cliente"), più un campo testo libero per chi non è in nessuna lista
  // (una persona lato cliente, es. "Andrea" — mai in Consulenti).
  consulenti?: { consulenteId: string; nome: string }[];
  onCreata: () => void;
};

/**
 * "+ Nuova attività" — aggiunta libera di un task alla roadmap, un elemento alla volta (POST
 * /api/attivita/crea), a differenza di "Genera roadmap" (template prodotto, tutta la roadmap in un
 * colpo, solo nel tab per-cliente) o della generazione automatica dai meeting. Estratta da
 * AttivitaTab.tsx (dove viveva non esportata) e generalizzata con un `clienteId` opzionale per
 * riuso anche in AttivitaGlobali.tsx (redesign Attività, 08/09/2026, blocco "creazione rapida
 * mancante" — lì non c'è un cliente di contesto, va scelto). Stesso pattern toggle-apri/annulla di
 * "+ Nuovo meeting" in MeetingTab.tsx. `fase` ha un `<datalist>` con le fasi già presenti
 * (fasiDisponibili) ma resta testo libero. Dopo la creazione richiama `onCreata` (il chiamante
 * ricarica dati reali, non un aggiornamento ottimistico: il nuovo task può appartenere a una fase
 * non ancora presente nei dati locali).
 */
export function NuovaAttivitaForm({ clienteId: clienteIdFisso, clienti = [], fasiDisponibili, consulenti = [], onCreata }: Props) {
  const [aperto, setAperto] = useState(false);
  const [clienteIdScelto, setClienteIdScelto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [fase, setFase] = useState("");
  const [assegnatariSelezionati, setAssegnatariSelezionati] = useState<Set<string>>(new Set());
  const [nuovoNomeAssegnatario, setNuovoNomeAssegnatario] = useState("");
  const [dataInizio, setDataInizio] = useState(oggiIso());
  const [dataFine, setDataFine] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const clienteId = clienteIdFisso ?? clienteIdScelto;
  const opzioniAssegnatari = [...consulenti.map((c) => c.nome), ...RUOLI_INTERNI, ETICHETTA_CLIENTE];

  function chiudiEResetta() {
    setAperto(false);
    setClienteIdScelto("");
    setDescrizione("");
    setFase("");
    setAssegnatariSelezionati(new Set());
    setNuovoNomeAssegnatario("");
    setDataInizio(oggiIso());
    setDataFine("");
    setErrore(null);
  }

  function toggleAssegnatario(nome: string) {
    setAssegnatariSelezionati((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  function aggiungiAssegnatarioLibero() {
    const nome = nuovoNomeAssegnatario.trim();
    if (!nome) return;
    setAssegnatariSelezionati((prev) => new Set(prev).add(nome));
    setNuovoNomeAssegnatario("");
  }

  async function handleSalva() {
    setErrore(null);
    setSalvando(true);
    try {
      const assegnatari = assegnatariSelezionati.size > 0 ? Array.from(assegnatariSelezionati) : [SENTINELLA_NON_ASSEGNATO];
      const res = await fetch("/api/attivita/crea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, descrizione, fase, assegnatari, dataInizio, dataFine }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      chiudiEResetta();
      onCreata();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="rounded-xl border border-ink-300 bg-surface-card text-ink-700 hover:border-brand hover:text-brand text-sm font-semibold px-4 py-2.5 transition cursor-pointer w-fit"
      >
        + Nuova attività
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-4 space-y-2.5">
      {!clienteIdFisso && (
        <div>
          <label className={labelClass}>Cliente</label>
          <select className={inputClass} value={clienteIdScelto} onChange={(e) => setClienteIdScelto(e.target.value)} autoFocus>
            <option value="">Scegli un cliente…</option>
            {clienti
              .slice()
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map((c) => (
                <option key={c.clienteId} value={c.clienteId}>
                  {c.nome}
                </option>
              ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>Descrizione</label>
        <input
          className={inputClass}
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="Cosa va fatto"
          autoFocus={Boolean(clienteIdFisso)}
        />
      </div>
      <div>
        <label className={labelClass}>Fase</label>
        <SelettoreFase value={fase} onChange={setFase} opzioni={fasiDisponibili} />
      </div>
      <div>
        <label className={labelClass}>Assegnatari (opzionale — vuoto = &quot;Da assegnare&quot;)</label>
        <div className="rounded-xl border border-ink-300 p-2.5 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-h-32 overflow-y-auto">
            {Array.from(new Set([...opzioniAssegnatari, ...assegnatariSelezionati])).map((nome) => (
              <label key={nome} className="flex items-center gap-1.5 text-xs text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assegnatariSelezionati.has(nome)}
                  onChange={() => toggleAssegnatario(nome)}
                  className="accent-current text-brand flex-shrink-0"
                />
                {nome}
              </label>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={nuovoNomeAssegnatario}
              onChange={(e) => setNuovoNomeAssegnatario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  aggiungiAssegnatarioLibero();
                }
              }}
              placeholder="Aggiungi un nome…"
              className="flex-1 min-w-0 rounded-lg border border-ink-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
            />
            <button
              type="button"
              onClick={aggiungiAssegnatarioLibero}
              className="rounded-lg border border-ink-300 text-xs font-semibold px-2 text-ink-700 hover:bg-surface transition cursor-pointer flex-shrink-0"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className={labelClass}>Data inizio</label>
          {/* Date-picker nativo invisibile sotto un'etichetta sempre in italiano, stessa tecnica di
              AttivitaLista.tsx — mai un formato assoluto americano tipo "08/14/2026". showPicker()
              esplicito su click (bug osservato dal vivo, 09/2026): Chrome/Edge recenti possono
              rifiutarsi di aprire il calendario nativo al click su un input completamente
              invisibile (opacity:0), come misura anti-clickjacking — il click continua a dare
              focus regolarmente, solo il popup non compariva più. showPicker() lo richiede in modo
              esplicito, innescato dallo stesso gesto utente: funziona a prescindere da quella
              euristica. Optional chaining: niente-op sui browser che non lo supportano ancora,
              ricade sul comportamento di prima. */}
          <div className={`relative ${inputClass}`}>
            <input
              type="date"
              value={dataInizio}
              onChange={(e) => setDataInizio(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <span className="pointer-events-none block truncate">{formatDataRelativa(dataInizio)}</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>Scadenza</label>
          <div className={`relative ${inputClass}`}>
            <input
              type="date"
              value={dataFine}
              onChange={(e) => setDataFine(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <span className="pointer-events-none block truncate text-ink-900">
              {dataFine ? formatDataRelativa(dataFine) : "Seleziona una data"}
            </span>
          </div>
        </div>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSalva}
          disabled={salvando || !clienteId || !descrizione.trim() || !fase.trim() || !dataFine}
          className="rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
        >
          {salvando ? "Salvataggio…" : "Aggiungi attività"}
        </button>
        <button
          type="button"
          onClick={chiudiEResetta}
          className="rounded-xl border border-ink-300 text-sm font-semibold px-4 py-2.5 text-ink-700 hover:bg-surface transition"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

/**
 * "Fase" era un `<input list>` + `<datalist>` nativo — un combobox solo sulla carta: la
 * tendina di suggerimenti non compare finché non inizi a digitare (nessun modo di "aprire e
 * scorrere" come un vero menu), inconsistente da browser a browser, e senza alcuna indicazione
 * visiva di essere altro che un campo di testo — bug segnalato dal vivo (11/2026, "è un campo di
 * inserimento anziché un menù a tendina"). Sostituito da un combobox vero (click/focus apre la
 * tendina con tutte le fasi esistenti, digitare filtra la lista) che resta comunque testo libero:
 * una fase nuova mai vista prima si digita e basta, esattamente come prima — stesso spirito di
 * ComboboxMultiSelect.tsx (stesso schema click-fuori-per-chiudere), ma a selezione singola e con
 * inserimento libero, che quel componente non supporta.
 */
function SelettoreFase({ value, onChange, opzioni }: { value: string; onChange: (v: string) => void; opzioni: string[] }) {
  const [aperto, setAperto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtrate = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return opzioni;
    return opzioni.filter((f) => f.toLowerCase().includes(q));
  }, [opzioni, value]);

  useEffect(() => {
    if (!aperto) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setAperto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [aperto]);

  return (
    <div className="relative" ref={rootRef}>
      {/* Non riusa `inputClass` direttamente sul contenitore: quella classe include focus:ring-2/
          focus:border-brand pensate per un <input> vero, ma qui è un <div> che non riceve mai il
          focus (l'<input> dentro sì) — focus-within: al posto di focus: perché il bordo/anello
          reagisca comunque quando si digita. */}
      <div className="relative flex items-center w-full rounded-xl border border-ink-300 px-3 py-2 pr-8 focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand transition">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setAperto(true);
          }}
          onFocus={() => setAperto(true)}
          placeholder="Fase in corso, o una nuova"
          className="w-full outline-none bg-transparent text-sm"
        />
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      </div>
      {aperto && opzioni.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-ink-300 bg-surface-card shadow-lg py-1">
          {filtrate.length > 0 ? (
            filtrate.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  onChange(f);
                  setAperto(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-surface cursor-pointer"
              >
                {f}
              </button>
            ))
          ) : (
            <p className="px-3 py-1.5 text-xs text-ink-500">Nessuna fase esistente corrisponde — verrà creata una nuova.</p>
          )}
        </div>
      )}
    </div>
  );
}
