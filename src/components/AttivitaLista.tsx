"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronUp, ChevronsUpDown, MoreVertical } from "lucide-react";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";
import { raggruppaPerStato } from "@/lib/roadmap";
import { descrizioneScadenza, formatStatoAttivita, iniziali } from "@/lib/format";
import { estraiMeetingIdDaTaskId } from "@/lib/meeting";
import {
  classificaAssegnatario,
  ETICHETTA_CLIENTE,
  RUOLI_INTERNI,
  SENTINELLA_NON_ASSEGNATO,
} from "@/lib/assegnatari";
import { UndoToast } from "@/components/ui/UndoToast";

const STATI_MENU: StatoAttivita[] = ["todo", "wip", "done", "blocked"];
const COL_RESPONSABILE = "w-[130px]";
const COL_SCADENZA = "w-[120px]";
const COL_STATO = "w-14";
const COL_AZIONI = "w-6";

/** Colonne ordinabili cliccando l'intestazione — "Stato" è escluso: è già l'asse di
 * raggruppamento (ogni card è già un unico stato), ordinarlo dentro un gruppo sarebbe un no-op. */
type ColonnaSort = "descrizione" | "responsabile" | "dataFine";
type StatoSort = { colonna: ColonnaSort; direzione: "asc" | "desc" };

function confrontaPerColonna(a: AttivitaClienteRow, b: AttivitaClienteRow, colonna: ColonnaSort): number {
  if (colonna === "dataFine") return a.dataFine.localeCompare(b.dataFine); // YYYY-MM-DD: ordine lessicografico = ordine cronologico
  if (colonna === "responsabile") return a.assegnatari.join(", ").localeCompare(b.assegnatari.join(", "), "it", { sensitivity: "base" });
  return a[colonna].localeCompare(b[colonna], "it", { sensitivity: "base" });
}

/** Per le righe da meeting, "fase" è "Meeting: <titolo lungo> (<data>)" — troppo lungo per un
 * badge. Ne teniamo solo la data: chi vuole il resto clicca il badge (porta al meeting). */
function faseCompatta(fase: string, isMeeting: boolean): string {
  if (!isMeeting) return fase;
  const m = fase.match(/\(([^)]+)\)\s*$/);
  return m ? `Meeting del ${m[1]}` : "Meeting";
}

type Props = {
  attivita: AttivitaClienteRow[];
  onCambiaStato: (attivitaId: string, nuovoStato: StatoAttivita, notaTeam?: string) => void;
  onCambiaScadenza: (attivitaId: string, nuovaDataFine: string) => void;
  onCambiaAssegnatari: (attivitaId: string, assegnatari: string[]) => void;
  onElimina: (attivitaId: string) => void;
  onVaiAMeeting?: (meetingId: string) => void;
  // clienteId -> nome, solo nella vista aggregata multi-cliente (AttivitaGlobali.tsx). Assente nel
  // tab per-cliente esistente (AttivitaTab.tsx): lì il cliente è già il contesto della pagina.
  nomeClientePer?: Map<string, string>;
  // Identità note per il popover di editing assegnatari (consulenti reali + i 2 ruoli interni +
  // "Cliente") — un assegnatario già presente ma non in questa lista (una persona lato cliente,
  // es. "Andrea") resta comunque selezionabile/deselezionabile, solo non compare come suggerimento
  // per un task che non l'ha ancora. Array vuoto = solo ruoli/Cliente/testo libero, mai un crash.
  consulenti?: { consulenteId: string; nome: string }[];
};

/**
 * Vista alternativa al Gantt (`RoadmapGantt.tsx`, invariato): raggruppa per stato di avanzamento
 * invece che per fase, ispirata a una board ClickUp. Il cambio stato avviene da un piccolo menu
 * sulla riga (non drag-and-drop, nessuna nuova dipendenza) — "Bloccato" richiede sempre una nota,
 * stesso vincolo già imposto da POST /api/attivita/stato. Pattern dei popover (nota-blocco,
 * assegnatari) duplicato deliberatamente da RoadmapGantt (non estratto in comune) per non toccare
 * quel componente, già in produzione e verificato.
 *
 * Redesign UX 08/09/2026 (critica strutturata dell'utente, verificata contro i dati reali prima di
 * disegnare la soluzione — vedi il piano): ordine di default per scadenza (scadute in cima per
 * costruzione, nessuna logica speciale), checkbox rapida per "fatto", pill di stato ridotto al
 * solo controllo (il gruppo porta già l'etichetta), scadenze scadute in rosso con testo esplicito,
 * date sempre in italiano (date-picker nativo reso invisibile sotto un'etichetta formattata, mai
 * sostituito: resta accessibile), cestino spostato in un menu "⋯" con eliminazione posticipata e
 * annullabile (UndoToast), assegnatari multipli mostrati come stack di avatar distinti per
 * persona/ruolo/cliente/non-assegnato.
 *
 * Nota sul contenitore dei gruppi: niente `overflow-hidden` sulla card (a differenza di una prima
 * versione) — tagliava i menu a tendina delle ultime righe di ogni gruppo. Gli angoli arrotondati
 * dell'header colorato si ottengono con `rounded-t-2xl` esplicito sull'header stesso, non più
 * per ritaglio del genitore.
 */
export function AttivitaLista({
  attivita,
  onCambiaStato,
  onCambiaScadenza,
  onCambiaAssegnatari,
  onElimina,
  onVaiAMeeting,
  nomeClientePer,
  consulenti = [],
}: Props) {
  const [menuApertoPer, setMenuApertoPer] = useState<string | null>(null);
  const [popoverBloccoPer, setPopoverBloccoPer] = useState<string | null>(null);
  const [notaBozza, setNotaBozza] = useState("");
  const [popoverAssegnatariPer, setPopoverAssegnatariPer] = useState<string | null>(null);
  const [menuKebabPer, setMenuKebabPer] = useState<string | null>(null);
  // Id delle attività in attesa di eliminazione reale: nascoste subito dalla lista, l'API DELETE
  // vera parte solo se il rispettivo UndoToast scade senza essere annullato — vedi handleEliminaRiga
  // sotto. Un Set (non una singola stringa) perché più eliminazioni possono restare in sospeso
  // insieme (righe diverse, click ravvicinati).
  const [inSospesoPerEliminazione, setInSospesoPerEliminazione] = useState<Set<string>>(new Set());
  // Default: scadenza crescente — le scadute (date più vecchie) risultano già in cima per
  // costruzione, nessuna logica "scadute in cima" separata dall'ordinamento stesso. Un clic
  // sull'intestazione ordina DENTRO ciascun gruppo-stato, senza mescolare i gruppi tra loro — sono
  // già la struttura portante della vista (board-like), un sort globale li romperebbe.
  const [sort, setSort] = useState<StatoSort | null>({ colonna: "dataFine", direzione: "asc" });

  function handleClickColonna(colonna: ColonnaSort) {
    setSort((prev) => {
      if (!prev || prev.colonna !== colonna) return { colonna, direzione: "asc" };
      if (prev.direzione === "asc") return { colonna, direzione: "desc" };
      return null; // terzo clic sulla stessa colonna -> torna all'ordine naturale (per `ordine`)
    });
  }

  function handleScegliStato(a: AttivitaClienteRow, nuovoStato: StatoAttivita) {
    setMenuApertoPer(null);
    if (nuovoStato === "blocked") {
      setPopoverBloccoPer(a.attivitaId);
      setNotaBozza("");
      return;
    }
    onCambiaStato(a.attivitaId, nuovoStato);
  }

  function confermaBlocco(attivitaId: string) {
    if (!notaBozza.trim()) return;
    onCambiaStato(attivitaId, "blocked", notaBozza.trim());
    setPopoverBloccoPer(null);
  }

  function handleEliminaRiga(attivitaId: string) {
    setMenuKebabPer(null);
    setInSospesoPerEliminazione((prev) => new Set(prev).add(attivitaId));
  }

  function annullaEliminazione(attivitaId: string) {
    setInSospesoPerEliminazione((prev) => {
      const next = new Set(prev);
      next.delete(attivitaId);
      return next;
    });
  }

  function scadenzaEliminazione(attivitaId: string) {
    annullaEliminazione(attivitaId); // smonta il toast
    onElimina(attivitaId); // solo ora parte davvero la chiamata DELETE
  }

  const attivitaVisibile = attivita.filter((a) => !inSospesoPerEliminazione.has(a.attivitaId));
  const gruppi = raggruppaPerStato(attivitaVisibile);

  return (
    <div className="space-y-4">
      {gruppi.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessuna attività.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            <span className="w-4 flex-shrink-0" /> {/* colonna checkbox */}
            <IntestazioneOrdinabile colonna="descrizione" sort={sort} onClick={handleClickColonna} className="flex-1 text-left">
              Task
            </IntestazioneOrdinabile>
            <IntestazioneOrdinabile colonna="responsabile" sort={sort} onClick={handleClickColonna} className={`flex-shrink-0 ${COL_RESPONSABILE} text-left`}>
              Assegnatari
            </IntestazioneOrdinabile>
            <IntestazioneOrdinabile colonna="dataFine" sort={sort} onClick={handleClickColonna} className={`flex-shrink-0 ${COL_SCADENZA} text-left`}>
              Scadenza
            </IntestazioneOrdinabile>
            <span className={`flex-shrink-0 ${COL_STATO} text-right`}>Stato</span>
            <span className={`flex-shrink-0 ${COL_AZIONI}`} />
          </div>

          {gruppi.map((gruppo) => {
            const info = formatStatoAttivita(gruppo.stato);
            const righe = sort ? [...gruppo.attivita].sort((a, b) => confrontaPerColonna(a, b, sort.colonna) * (sort.direzione === "asc" ? 1 : -1)) : gruppo.attivita;
            return (
              <div key={gruppo.stato} className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm">
                <div className={`flex items-center gap-2 px-5 py-2 rounded-t-2xl ${info.puntino} text-white`}>
                  <span className="text-xs font-semibold uppercase tracking-wide">{info.label}</span>
                  <span className="text-[11px] opacity-80">{gruppo.attivita.length}</span>
                </div>

                <div>
                  {righe.map((a) => (
                    <RigaAttivita
                      key={a.attivitaId}
                      attivita={a}
                      menuAperto={menuApertoPer === a.attivitaId}
                      popoverBloccoAperto={popoverBloccoPer === a.attivitaId}
                      popoverAssegnatariAperto={popoverAssegnatariPer === a.attivitaId}
                      menuKebabAperto={menuKebabPer === a.attivitaId}
                      notaBozza={notaBozza}
                      consulenti={consulenti}
                      onApriMenu={() => setMenuApertoPer(a.attivitaId)}
                      onChiudiMenu={() => setMenuApertoPer(null)}
                      onSceltaStato={(s) => handleScegliStato(a, s)}
                      onNotaBozzaChange={setNotaBozza}
                      onChiudiBlocco={() => setPopoverBloccoPer(null)}
                      onConfermaBlocco={() => confermaBlocco(a.attivitaId)}
                      onCambiaScadenza={(v) => onCambiaScadenza(a.attivitaId, v)}
                      onApriPopoverAssegnatari={() => setPopoverAssegnatariPer(a.attivitaId)}
                      onChiudiPopoverAssegnatari={() => setPopoverAssegnatariPer(null)}
                      onSalvaAssegnatari={(nuovi) => {
                        setPopoverAssegnatariPer(null);
                        onCambiaAssegnatari(a.attivitaId, nuovi);
                      }}
                      onApriKebab={() => setMenuKebabPer(a.attivitaId)}
                      onChiudiKebab={() => setMenuKebabPer(null)}
                      onElimina={() => handleEliminaRiga(a.attivitaId)}
                      onVaiAMeeting={onVaiAMeeting}
                      nomeCliente={nomeClientePer?.get(a.clienteId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Stack di toast "eliminata — Annulla", uno per eliminazione in sospeso — vedi il commento
          su inSospesoPerEliminazione sopra. Fixed in basso, sopra ogni altro contenuto della pagina. */}
      {inSospesoPerEliminazione.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2">
          {Array.from(inSospesoPerEliminazione).map((attivitaId) => (
            <UndoToast
              key={attivitaId}
              messaggio="Attività eliminata."
              onAnnulla={() => annullaEliminazione(attivitaId)}
              onScadenza={() => scadenzaEliminazione(attivitaId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IntestazioneOrdinabile({
  colonna,
  sort,
  onClick,
  className,
  children,
}: {
  colonna: ColonnaSort;
  sort: StatoSort | null;
  onClick: (colonna: ColonnaSort) => void;
  className: string;
  children: React.ReactNode;
}) {
  const attiva = sort?.colonna === colonna;
  const Icona = !attiva ? ChevronsUpDown : sort.direzione === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onClick(colonna)}
      title="Ordina"
      className={`inline-flex items-center gap-1 cursor-pointer hover:text-ink-700 transition-colors ${attiva ? "text-ink-700" : ""} ${className}`}
    >
      {children}
      <Icona size={11} className={`flex-shrink-0 ${attiva ? "opacity-100" : "opacity-40"}`} />
    </button>
  );
}

/** Un avatar per un singolo assegnatario — stile diverso per tipo (persona/ruolo/cliente/non-
 * assegnato), mai lo stesso trattamento pieno per un ruolo scoperto che per una persona vera:
 * quello era esattamente il problema segnalato ("Project Manager" con avatar "PM" sembrava un
 * assegnatario reale). Tooltip individuale (non solo quello dell'intero stack): per un ruolo dice
 * esplicitamente "Da assegnare: <ruolo>", per il sentinella solo "Da assegnare". */
function AvatarAssegnatario({ nome }: { nome: string }) {
  const tipo = classificaAssegnatario(nome);
  if (tipo === "persona") {
    return (
      <span
        title={nome}
        className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] font-semibold flex items-center justify-center flex-shrink-0 ring-2 ring-surface-card"
      >
        {iniziali(nome)}
      </span>
    );
  }
  if (tipo === "cliente") {
    return (
      <span
        title="Cliente"
        className="w-6 h-6 rounded-full bg-ink-900 text-white text-[9px] font-semibold flex items-center justify-center flex-shrink-0 ring-2 ring-surface-card"
      >
        CL
      </span>
    );
  }
  // ruolo o non-assegnato: mai lo stesso pieno di una persona vera — tratteggiato, nessun'iniziale.
  return (
    <span
      title={tipo === "ruolo" ? `Da assegnare: ${nome}` : SENTINELLA_NON_ASSEGNATO}
      className="w-6 h-6 rounded-full border-2 border-dashed border-ink-300 text-ink-400 text-[10px] flex items-center justify-center flex-shrink-0 ring-2 ring-surface-card"
    >
      ?
    </span>
  );
}

function StackAssegnatari({ assegnatari, onClick }: { assegnatari: string[]; onClick: () => void }) {
  const visibili = assegnatari.slice(0, 3);
  const extra = assegnatari.length - visibili.length;
  return (
    <button type="button" onClick={onClick} title="Cambia assegnatari" className="flex items-center -space-x-1.5 cursor-pointer flex-shrink-0">
      {visibili.map((nome, i) => (
        <AvatarAssegnatario key={i} nome={nome} />
      ))}
      {extra > 0 && (
        <span className="w-6 h-6 rounded-full bg-ink-300/60 text-ink-700 text-[10px] font-semibold flex items-center justify-center flex-shrink-0 ring-2 ring-surface-card">
          +{extra}
        </span>
      )}
    </button>
  );
}

/** Popover di editing assegnatari — stesso pattern dei popover già in questo file (nota-blocco):
 * checkbox per ogni identità nota (consulenti reali + i 2 ruoli interni + "Cliente") più un campo
 * testo libero per una persona lato cliente non in elenco (es. "Andrea"/"Sherdil" — mai in
 * Consulenti, sono persone del cliente stesso, non del team ALC). Un assegnatario già presente sul
 * task ma non altrimenti noto resta comunque nell'elenco (già selezionato), mai perso al primo
 * render del popover. */
function PopoverAssegnatari({
  assegnatariCorrenti,
  consulenti,
  onSalva,
  onChiudi,
}: {
  assegnatariCorrenti: string[];
  consulenti: { consulenteId: string; nome: string }[];
  onSalva: (nuovi: string[]) => void;
  onChiudi: () => void;
}) {
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set(assegnatariCorrenti));
  const [nuovoNome, setNuovoNome] = useState("");

  const opzioniNote = [...consulenti.map((c) => c.nome), ...RUOLI_INTERNI, ETICHETTA_CLIENTE];
  const tutteLeOpzioni = Array.from(new Set([...opzioniNote, ...assegnatariCorrenti]));

  function toggle(nome: string) {
    setSelezionati((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  function aggiungiLibero() {
    const nome = nuovoNome.trim();
    if (!nome) return;
    setSelezionati((prev) => new Set(prev).add(nome));
    setNuovoNome("");
  }

  function salva() {
    const lista = Array.from(selezionati);
    onSalva(lista.length > 0 ? lista : [SENTINELLA_NON_ASSEGNATO]);
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-xl border border-ink-300 bg-surface-card shadow-lg p-3 space-y-2.5">
      <p className="text-xs font-semibold text-ink-900">Assegnatari</p>
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {tutteLeOpzioni.map((nome) => (
          <label key={nome} className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selezionati.has(nome)}
              onChange={() => toggle(nome)}
              className="accent-current text-brand flex-shrink-0"
            />
            <span className="truncate">{nome}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={nuovoNome}
          onChange={(e) => setNuovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              aggiungiLibero();
            }
          }}
          placeholder="Aggiungi un nome…"
          className="flex-1 min-w-0 rounded-lg border border-ink-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
        />
        <button
          type="button"
          onClick={aggiungiLibero}
          className="rounded-lg border border-ink-300 text-xs font-semibold px-2 text-ink-700 hover:bg-surface transition cursor-pointer flex-shrink-0"
        >
          +
        </button>
      </div>
      <div className="flex justify-end gap-2 pt-1 border-t border-ink-300/40">
        <button type="button" onClick={onChiudi} className="text-[11px] font-medium px-2 py-1 rounded-lg text-ink-500 hover:bg-ink-300/40 cursor-pointer">
          Annulla
        </button>
        <button
          type="button"
          onClick={salva}
          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-cta hover:bg-cta-dark text-white cursor-pointer"
        >
          Salva
        </button>
      </div>
    </div>
  );
}

function RigaAttivita({
  attivita,
  menuAperto,
  popoverBloccoAperto,
  popoverAssegnatariAperto,
  menuKebabAperto,
  notaBozza,
  consulenti,
  onApriMenu,
  onChiudiMenu,
  onSceltaStato,
  onNotaBozzaChange,
  onChiudiBlocco,
  onConfermaBlocco,
  onCambiaScadenza,
  onApriPopoverAssegnatari,
  onChiudiPopoverAssegnatari,
  onSalvaAssegnatari,
  onApriKebab,
  onChiudiKebab,
  onElimina,
  onVaiAMeeting,
  nomeCliente,
}: {
  attivita: AttivitaClienteRow;
  menuAperto: boolean;
  popoverBloccoAperto: boolean;
  popoverAssegnatariAperto: boolean;
  menuKebabAperto: boolean;
  notaBozza: string;
  consulenti: { consulenteId: string; nome: string }[];
  onApriMenu: () => void;
  onChiudiMenu: () => void;
  onSceltaStato: (s: StatoAttivita) => void;
  onNotaBozzaChange: (v: string) => void;
  onChiudiBlocco: () => void;
  onConfermaBlocco: () => void;
  onCambiaScadenza: (v: string) => void;
  onApriPopoverAssegnatari: () => void;
  onChiudiPopoverAssegnatari: () => void;
  onSalvaAssegnatari: (nuovi: string[]) => void;
  onApriKebab: () => void;
  onChiudiKebab: () => void;
  onElimina: () => void;
  onVaiAMeeting?: (meetingId: string) => void;
  nomeCliente?: string;
}) {
  const info = formatStatoAttivita(attivita.stato);
  const isMeeting = attivita.blocco === "meeting";
  const meetingId = isMeeting ? estraiMeetingIdDaTaskId(attivita.taskId) : null;
  const scadenza = descrizioneScadenza(attivita.dataFine, attivita.stato);

  return (
    <div className="group flex items-start gap-3 px-5 py-3 hover:bg-surface/70 transition-colors border-t border-surface first:border-t-0">
      <input
        type="checkbox"
        checked={attivita.stato === "done"}
        onChange={(e) => onSceltaStato(e.target.checked ? "done" : "todo")}
        title={attivita.stato === "done" ? "Segna come da fare" : "Segna come fatta"}
        className="w-4 h-4 mt-1 rounded border-ink-300 text-brand focus:ring-2 focus:ring-brand/30 cursor-pointer flex-shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="text-base text-ink-900">{attivita.descrizione}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {nomeCliente && (
            // Pill piena e scura (non un tint chiaro come le altre): qui il "quale cliente" è
            // l'asse di lettura primario della vista aggregata, e sia il badge fase di default
            // (grigio chiaro) sia quello meeting (azzurro chiaro) sono già tint chiari — un terzo
            // tint chiaro (anche con l'azzurro brand) si confonderebbe visivamente con l'uno o
            // l'altro sui dati reali (verificato: la maggior parte dei task viene da un meeting).
            <a
              href={`/dashboard/cliente/${encodeURIComponent(attivita.clienteId)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Vai alla scheda di ${nomeCliente}`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-ink-900 text-white hover:bg-ink-700 cursor-pointer transition-colors truncate max-w-[160px]"
            >
              {nomeCliente}
            </a>
          )}
          {meetingId && onVaiAMeeting ? (
            <button
              type="button"
              onClick={() => onVaiAMeeting(meetingId)}
              title={`${attivita.fase} — vai al meeting`}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors"
            >
              <Calendar size={11} className="flex-shrink-0" />
              {faseCompatta(attivita.fase, true)}
            </button>
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate max-w-[220px] ${
                isMeeting ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-ink-300/40 text-ink-500 border border-ink-300"
              }`}
              title={attivita.fase}
            >
              {isMeeting && <Calendar size={11} className="flex-shrink-0" />}
              {faseCompatta(attivita.fase, isMeeting)}
            </span>
          )}
          {attivita.notaTeam && (
            <span className="text-[10px] text-red-500 italic truncate max-w-[200px]" title={attivita.notaTeam}>
              &ldquo;{attivita.notaTeam}&rdquo;
            </span>
          )}
        </div>
      </div>

      <div className={`relative flex-shrink-0 ${COL_RESPONSABILE}`}>
        <StackAssegnatari assegnatari={attivita.assegnatari} onClick={onApriPopoverAssegnatari} />
        {popoverAssegnatariAperto && (
          <PopoverAssegnatari
            assegnatariCorrenti={attivita.assegnatari}
            consulenti={consulenti}
            onSalva={onSalvaAssegnatari}
            onChiudi={onChiudiPopoverAssegnatari}
          />
        )}
      </div>

      <div className={`relative flex-shrink-0 ${COL_SCADENZA}`}>
        {/* Date-picker nativo reso invisibile (mai sostituito: resta accessibile/apribile con un
            click ovunque nella cella) sotto un'etichetta sempre in italiano — "08/14/2026" era il
            problema, non il calendario stesso. Rosso + testo esplicito se scaduta (stesso rosso di
            STILE_LIVELLO.critico, mai un colore inventato qui). */}
        <input
          type="date"
          value={attivita.dataFine}
          onChange={(e) => e.target.value && onCambiaScadenza(e.target.value)}
          aria-label="Cambia scadenza"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <span
          className={`pointer-events-none block text-xs px-1 py-0.5 rounded-md truncate ${
            scadenza.scaduta ? "text-red-600 font-semibold" : "text-ink-500"
          }`}
        >
          {scadenza.testo}
        </span>
      </div>

      <div className={`relative flex-shrink-0 ${COL_STATO} flex justify-end`}>
        <button
          type="button"
          onClick={menuAperto ? onChiudiMenu : onApriMenu}
          title={`Stato: ${info.label} — clicca per cambiare`}
          className={`cursor-pointer flex items-center gap-0.5 px-1.5 py-1 rounded-lg border ${info.classe}`}
        >
          <span className={`w-2 h-2 rounded-full ${info.puntino}`} />
          <ChevronDown size={12} className="opacity-60" />
        </button>

        {menuAperto && (
          <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-ink-300 bg-surface-card shadow-lg py-1">
            {STATI_MENU.map((s) => {
              const opzione = formatStatoAttivita(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSceltaStato(s)}
                  className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-surface cursor-pointer flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-sm ${opzione.puntino}`} />
                  {opzione.label}
                </button>
              );
            })}
          </div>
        )}

        {popoverBloccoAperto && (
          <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-xl border border-ink-300 bg-surface-card shadow-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-ink-900">Perché è bloccata?</p>
            <textarea
              autoFocus
              value={notaBozza}
              onChange={(e) => onNotaBozzaChange(e.target.value)}
              rows={2}
              placeholder="Motivo del blocco…"
              className="w-full rounded-lg border border-ink-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition resize-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onChiudiBlocco} className="text-[11px] font-medium px-2 py-1 rounded-lg text-ink-500 hover:bg-ink-300/40 cursor-pointer">
                Annulla
              </button>
              <button
                type="button"
                onClick={onConfermaBlocco}
                disabled={!notaBozza.trim()}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white cursor-pointer disabled:cursor-not-allowed"
              >
                Blocca
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`relative flex-shrink-0 ${COL_AZIONI} flex justify-end`}>
        {/* Visibile on-hover su desktop (sm:), sempre visibile su touch/viewport piccoli — niente
            affordance nascosta senza un modo di scoprirla su schermi piccoli. */}
        <button
          type="button"
          onClick={menuKebabAperto ? onChiudiKebab : onApriKebab}
          title="Altre azioni"
          className="text-ink-300 hover:text-ink-700 transition-colors cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <MoreVertical size={16} />
        </button>

        {menuKebabAperto && (
          <div className="absolute right-0 top-full mt-1 z-30 w-40 rounded-xl border border-ink-300 bg-surface-card shadow-lg py-1">
            <button
              type="button"
              onClick={onElimina}
              className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
            >
              Elimina
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
