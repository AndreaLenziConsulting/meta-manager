"use client";

import { useState } from "react";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";
import { raggruppaPerStato } from "@/lib/roadmap";
import { formatStatoAttivita, iniziali } from "@/lib/format";
import { estraiMeetingIdDaTaskId } from "@/lib/meeting";

const STATI_MENU: StatoAttivita[] = ["todo", "wip", "done", "blocked"];
const COL_RESPONSABILE = "w-[130px]";
const COL_SCADENZA = "w-[112px]";
const COL_STATO = "w-[92px]";
const COL_AZIONI = "w-6";

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
  onElimina: (attivitaId: string) => void;
  onVaiAMeeting?: (meetingId: string) => void;
  // clienteId -> nome, solo nella vista aggregata multi-cliente (AttivitaGlobali.tsx). Assente nel
  // tab per-cliente esistente (AttivitaTab.tsx): lì il cliente è già il contesto della pagina.
  nomeClientePer?: Map<string, string>;
};

/**
 * Vista alternativa al Gantt (`RoadmapGantt.tsx`, invariato): raggruppa per stato di avanzamento
 * invece che per fase, ispirata a una board ClickUp. Il cambio stato avviene da un piccolo menu
 * sulla riga (non drag-and-drop, nessuna nuova dipendenza) — "Bloccato" richiede sempre una nota,
 * stesso vincolo già imposto da POST /api/attivita/stato. Pattern dei popover (nota-blocco,
 * conferma-eliminazione) duplicato deliberatamente da RoadmapGantt (non estratto in comune) per
 * non toccare quel componente, già in produzione e verificato.
 *
 * Nota sul contenitore dei gruppi: niente `overflow-hidden` sulla card (a differenza di una prima
 * versione) — tagliava i menu a tendina delle ultime righe di ogni gruppo. Gli angoli arrotondati
 * dell'header colorato si ottengono con `rounded-t-2xl` esplicito sull'header stesso, non più
 * per ritaglio del genitore.
 */
export function AttivitaLista({ attivita, onCambiaStato, onCambiaScadenza, onElimina, onVaiAMeeting, nomeClientePer }: Props) {
  const gruppi = raggruppaPerStato(attivita);

  const [menuApertoPer, setMenuApertoPer] = useState<string | null>(null);
  const [popoverBloccoPer, setPopoverBloccoPer] = useState<string | null>(null);
  const [notaBozza, setNotaBozza] = useState("");
  const [confermaEliminaPer, setConfermaEliminaPer] = useState<string | null>(null);

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

  function confermaElimina(attivitaId: string) {
    onElimina(attivitaId);
    setConfermaEliminaPer(null);
  }

  if (gruppi.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">Nessuna attività.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <span className="flex-1">Task</span>
        <span className={`flex-shrink-0 ${COL_RESPONSABILE}`}>Responsabile</span>
        <span className={`flex-shrink-0 ${COL_SCADENZA}`}>Scadenza</span>
        <span className={`flex-shrink-0 ${COL_STATO} text-right`}>Stato</span>
        <span className={`flex-shrink-0 ${COL_AZIONI}`} />
      </div>

      {gruppi.map((gruppo) => {
        const info = formatStatoAttivita(gruppo.stato);
        return (
          <div key={gruppo.stato} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className={`flex items-center gap-2 px-5 py-2 rounded-t-2xl ${info.puntino} text-white`}>
              <span className="text-xs font-semibold uppercase tracking-wide">{info.label}</span>
              <span className="text-[11px] opacity-80">{gruppo.attivita.length}</span>
            </div>

            <div>
              {gruppo.attivita.map((a) => (
                <RigaAttivita
                  key={a.attivitaId}
                  attivita={a}
                  menuAperto={menuApertoPer === a.attivitaId}
                  popoverBloccoAperto={popoverBloccoPer === a.attivitaId}
                  confermaEliminaAperto={confermaEliminaPer === a.attivitaId}
                  notaBozza={notaBozza}
                  onApriMenu={() => setMenuApertoPer(a.attivitaId)}
                  onChiudiMenu={() => setMenuApertoPer(null)}
                  onSceltaStato={(s) => handleScegliStato(a, s)}
                  onNotaBozzaChange={setNotaBozza}
                  onChiudiBlocco={() => setPopoverBloccoPer(null)}
                  onConfermaBlocco={() => confermaBlocco(a.attivitaId)}
                  onCambiaScadenza={(v) => onCambiaScadenza(a.attivitaId, v)}
                  onApriElimina={() => setConfermaEliminaPer(a.attivitaId)}
                  onChiudiElimina={() => setConfermaEliminaPer(null)}
                  onConfermaElimina={() => confermaElimina(a.attivitaId)}
                  onVaiAMeeting={onVaiAMeeting}
                  nomeCliente={nomeClientePer?.get(a.clienteId)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RigaAttivita({
  attivita,
  menuAperto,
  popoverBloccoAperto,
  confermaEliminaAperto,
  notaBozza,
  onApriMenu,
  onChiudiMenu,
  onSceltaStato,
  onNotaBozzaChange,
  onChiudiBlocco,
  onConfermaBlocco,
  onCambiaScadenza,
  onApriElimina,
  onChiudiElimina,
  onConfermaElimina,
  onVaiAMeeting,
  nomeCliente,
}: {
  attivita: AttivitaClienteRow;
  menuAperto: boolean;
  popoverBloccoAperto: boolean;
  confermaEliminaAperto: boolean;
  notaBozza: string;
  onApriMenu: () => void;
  onChiudiMenu: () => void;
  onSceltaStato: (s: StatoAttivita) => void;
  onNotaBozzaChange: (v: string) => void;
  onChiudiBlocco: () => void;
  onConfermaBlocco: () => void;
  onCambiaScadenza: (v: string) => void;
  onApriElimina: () => void;
  onChiudiElimina: () => void;
  onConfermaElimina: () => void;
  onVaiAMeeting?: (meetingId: string) => void;
  nomeCliente?: string;
}) {
  const info = formatStatoAttivita(attivita.stato);
  const isMeeting = attivita.blocco === "meeting";
  const meetingId = isMeeting ? estraiMeetingIdDaTaskId(attivita.taskId) : null;

  return (
    <div className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors border-t border-gray-50 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-base text-gray-800">{attivita.descrizione}</p>
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
              📅 {faseCompatta(attivita.fase, true)}
            </button>
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate max-w-[220px] ${
                isMeeting ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
              title={attivita.fase}
            >
              {isMeeting && "📅"} {faseCompatta(attivita.fase, isMeeting)}
            </span>
          )}
          {attivita.notaTeam && (
            <span className="text-[10px] text-red-500 italic truncate max-w-[200px]" title={attivita.notaTeam}>
              &ldquo;{attivita.notaTeam}&rdquo;
            </span>
          )}
        </div>
      </div>

      <div className={`flex items-center gap-1.5 flex-shrink-0 ${COL_RESPONSABILE}`} title={attivita.responsabile}>
        <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
          {iniziali(attivita.responsabile || "?")}
        </span>
        <span className="text-xs text-gray-500 hidden sm:inline truncate">{attivita.responsabile}</span>
      </div>

      <div className={`flex-shrink-0 ${COL_SCADENZA}`}>
        <input
          type="date"
          value={attivita.dataFine}
          onChange={(e) => e.target.value && onCambiaScadenza(e.target.value)}
          className="text-xs text-gray-500 bg-transparent border border-transparent hover:border-gray-200 focus:border-brand focus:ring-2 focus:ring-brand/30 rounded-md px-1 py-0.5 outline-none cursor-pointer transition-colors w-full"
        />
      </div>

      <div className={`relative flex-shrink-0 ${COL_STATO} flex justify-end`}>
        <button
          type="button"
          onClick={menuAperto ? onChiudiMenu : onApriMenu}
          className={`cursor-pointer text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-lg border ${info.classe}`}
        >
          {info.label}
        </button>

        {menuAperto && (
          <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
            {STATI_MENU.map((s) => {
              const opzione = formatStatoAttivita(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSceltaStato(s)}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-sm ${opzione.puntino}`} />
                  {opzione.label}
                </button>
              );
            })}
          </div>
        )}

        {popoverBloccoAperto && (
          <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-xl border border-gray-200 bg-white shadow-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-900">Perché è bloccata?</p>
            <textarea
              autoFocus
              value={notaBozza}
              onChange={(e) => onNotaBozzaChange(e.target.value)}
              rows={2}
              placeholder="Motivo del blocco…"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition resize-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onChiudiBlocco} className="text-[11px] font-medium px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer">
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
        <button
          type="button"
          onClick={confermaEliminaAperto ? onChiudiElimina : onApriElimina}
          title="Elimina attività"
          className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
        >
          <EliminaIcon />
        </button>

        {confermaEliminaAperto && (
          <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-xl border border-gray-200 bg-white shadow-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-900">Eliminare questa attività?</p>
            <p className="text-[11px] text-gray-400">Non si può annullare.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onChiudiElimina} className="text-[11px] font-medium px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer">
                Annulla
              </button>
              <button
                type="button"
                onClick={onConfermaElimina}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white cursor-pointer"
              >
                Elimina
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EliminaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
