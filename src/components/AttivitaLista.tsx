"use client";

import { useState } from "react";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";
import { raggruppaPerStato } from "@/lib/roadmap";
import { formatStatoAttivita } from "@/lib/format";
import { estraiMeetingIdDaTaskId } from "@/lib/meeting";

const STATI_MENU: StatoAttivita[] = ["todo", "wip", "done", "blocked"];
const COL_RESPONSABILE = "w-[130px]";
const COL_SCADENZA = "w-[112px]";
const COL_STATO = "w-[92px]";

function iniziali(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "?";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();
  return (parti[0][0] + parti[1][0]).toUpperCase();
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
  onVaiAMeeting?: (meetingId: string) => void;
};

/**
 * Vista alternativa al Gantt (`RoadmapGantt.tsx`, invariato): raggruppa per stato di avanzamento
 * invece che per fase, ispirata a una board ClickUp. Il cambio stato avviene da un piccolo menu
 * sulla riga (non drag-and-drop, nessuna nuova dipendenza) — "Bloccato" richiede sempre una nota,
 * stesso vincolo già imposto da POST /api/attivita/stato. Pattern del popover nota-blocco
 * duplicato deliberatamente da RoadmapGantt (non estratto in comune) per non toccare quel
 * componente, già in produzione e verificato.
 */
export function AttivitaLista({ attivita, onCambiaStato, onCambiaScadenza, onVaiAMeeting }: Props) {
  const gruppi = raggruppaPerStato(attivita);

  const [menuApertoPer, setMenuApertoPer] = useState<string | null>(null);
  const [popoverBloccoPer, setPopoverBloccoPer] = useState<string | null>(null);
  const [notaBozza, setNotaBozza] = useState("");

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
      </div>

      {gruppi.map((gruppo) => {
        const info = formatStatoAttivita(gruppo.stato);
        return (
          <div key={gruppo.stato} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className={`flex items-center gap-2 px-5 py-2 ${info.puntino} text-white`}>
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
                  notaBozza={notaBozza}
                  onApriMenu={() => setMenuApertoPer(a.attivitaId)}
                  onChiudiMenu={() => setMenuApertoPer(null)}
                  onSceltaStato={(s) => handleScegliStato(a, s)}
                  onNotaBozzaChange={setNotaBozza}
                  onChiudiBlocco={() => setPopoverBloccoPer(null)}
                  onConfermaBlocco={() => confermaBlocco(a.attivitaId)}
                  onCambiaScadenza={(v) => onCambiaScadenza(a.attivitaId, v)}
                  onVaiAMeeting={onVaiAMeeting}
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
  notaBozza,
  onApriMenu,
  onChiudiMenu,
  onSceltaStato,
  onNotaBozzaChange,
  onChiudiBlocco,
  onConfermaBlocco,
  onCambiaScadenza,
  onVaiAMeeting,
}: {
  attivita: AttivitaClienteRow;
  menuAperto: boolean;
  popoverBloccoAperto: boolean;
  notaBozza: string;
  onApriMenu: () => void;
  onChiudiMenu: () => void;
  onSceltaStato: (s: StatoAttivita) => void;
  onNotaBozzaChange: (v: string) => void;
  onChiudiBlocco: () => void;
  onConfermaBlocco: () => void;
  onCambiaScadenza: (v: string) => void;
  onVaiAMeeting?: (meetingId: string) => void;
}) {
  const info = formatStatoAttivita(attivita.stato);
  const isMeeting = attivita.blocco === "meeting";
  const meetingId = isMeeting ? estraiMeetingIdDaTaskId(attivita.taskId) : null;

  return (
    <div className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors border-t border-gray-50 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-base text-gray-800">{attivita.descrizione}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
    </div>
  );
}
