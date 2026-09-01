"use client";

import { useMemo, useState } from "react";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";
import type { GruppoFase } from "@/lib/roadmap";
import { aggiungiGiorni, giorniTra, oggiIso, prossimoStato, rangeProgetto } from "@/lib/roadmap";
import { formatDataBreve, formatSettimana, formatStatoAttivita } from "@/lib/format";

const LABEL_WIDTH = 260;
const AZIONI_WIDTH = 28;
const STATI_LEGENDA: StatoAttivita[] = ["todo", "wip", "done", "blocked"];

function pctFor(data: string, minData: string, maxData: string): number {
  const totale = giorniTra(minData, maxData);
  if (totale <= 0) return 0;
  return Math.min(100, Math.max(0, (giorniTra(minData, data) / totale) * 100));
}

function generaTick(minData: string, maxData: string): string[] {
  const totale = giorniTra(minData, maxData);
  if (totale <= 0) return [minData];
  // Etichette tipo "24 lug", non "24 luglio 2026": ~9 tick massimo, altrimenti si accavallano
  // (a differenza di TrendChart, qui lo spazio tra un punto e l'altro non è mai garantito uniforme).
  const passoSettimane = Math.max(1, Math.ceil(totale / 7 / 9));
  const passoGiorni = passoSettimane * 7;
  const tick: string[] = [];
  for (let g = 0; g <= totale; g += passoGiorni) tick.push(aggiungiGiorni(minData, g));
  return tick;
}

function contaStati(attivita: AttivitaClienteRow[]) {
  return {
    done: attivita.filter((a) => a.stato === "done").length,
    blocked: attivita.filter((a) => a.stato === "blocked").length,
  };
}

/** La prima fase non completamente "fatta" — o l'ultima, se sono tutte fatte — parte espansa di default. */
function faseInizialmenteEspansa(gruppi: GruppoFase[]): string | undefined {
  const inCorso = gruppi.find((g) => g.attivita.some((a) => a.stato !== "done"));
  return (inCorso ?? gruppi[gruppi.length - 1])?.fase;
}

type Props = {
  gruppi: GruppoFase[];
  onCambiaStato: (attivitaId: string, nuovoStato: StatoAttivita, notaTeam?: string) => void;
};

export function RoadmapGantt({ gruppi, onCambiaStato }: Props) {
  const tutte = useMemo(() => gruppi.flatMap((g) => g.attivita), [gruppi]);
  const range = useMemo(() => rangeProgetto(tutte), [tutte]);

  const [espanse, setEspanse] = useState<Set<string>>(
    () => new Set([faseInizialmenteEspansa(gruppi)].filter((f): f is string => !!f))
  );
  const [popoverBlocco, setPopoverBlocco] = useState<string | null>(null);
  const [notaBozza, setNotaBozza] = useState("");

  if (!range) return null;
  const { minData, maxData } = range;
  const oggi = oggiIso();
  const oggiInRange = oggi >= minData && oggi <= maxData;
  const oggiPct = pctFor(oggi, minData, maxData);
  // Non mostrare un tick regolare troppo vicino a "Oggi": si sovrapporrebbero le due etichette.
  const tick = generaTick(minData, maxData).filter((t) => !oggiInRange || Math.abs(pctFor(t, minData, maxData) - oggiPct) > 3);

  function toggleFase(fase: string) {
    setEspanse((prev) => {
      const next = new Set(prev);
      if (next.has(fase)) next.delete(fase);
      else next.add(fase);
      return next;
    });
  }

  function handleClickBarra(a: AttivitaClienteRow) {
    if (popoverBlocco) return; // non cambiare stato mentre si sta scrivendo il motivo di un blocco
    onCambiaStato(a.attivitaId, a.stato === "blocked" ? "todo" : prossimoStato(a.stato));
  }

  function confermaBlocco(attivitaId: string) {
    if (!notaBozza.trim()) return;
    onCambiaStato(attivitaId, "blocked", notaBozza.trim());
    setPopoverBlocco(null);
  }

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand" />
          <h3 className="font-semibold text-ink-900 text-[15px]">Roadmap</h3>
        </div>
        <ul className="flex gap-3 text-[11px] text-ink-500 flex-wrap">
          {STATI_LEGENDA.map((s) => {
            const info = formatStatoAttivita(s);
            return (
              <li key={s} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: info.barra }} />
                {info.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 760 }}>
          <div className="flex border-b border-ink-300/40 sticky top-0 bg-surface-card z-10">
            <div style={{ width: LABEL_WIDTH }} className="flex-shrink-0" />
            <div className="relative flex-1 h-7">
              {tick.map((t) => (
                <span
                  key={t}
                  className="absolute top-1.5 text-[10px] text-ink-500 -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${pctFor(t, minData, maxData)}%` }}
                >
                  {formatSettimana(t)}
                </span>
              ))}
              {oggiInRange && (
                <span
                  className="absolute top-1.5 text-[10px] font-semibold text-brand -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${oggiPct}%` }}
                >
                  Oggi
                </span>
              )}
            </div>
            <div style={{ width: AZIONI_WIDTH }} className="flex-shrink-0" />
          </div>

          <div className="max-h-[65vh] overflow-y-auto">
            {gruppi.map((gruppo) => {
              const conteggi = contaStati(gruppo.attivita);
              const aperta = espanse.has(gruppo.fase);
              return (
                <div key={gruppo.fase} className="border-b border-ink-300/40 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleFase(gruppo.fase)}
                    className="w-full flex items-center justify-between gap-2 px-5 py-2.5 bg-surface hover:bg-ink-300/40 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-ink-700">
                      <ChevronIcon aperta={aperta} />
                      {gruppo.fase}
                    </span>
                    <span className="text-[11px] text-ink-500 whitespace-nowrap">
                      {conteggi.done}/{gruppo.attivita.length} fatte
                      {conteggi.blocked > 0 && (
                        <span className="text-red-500 font-semibold"> · {conteggi.blocked} bloccate</span>
                      )}
                    </span>
                  </button>

                  {aperta &&
                    gruppo.attivita.map((a) => (
                      <RigaAttivita
                        key={a.attivitaId}
                        attivita={a}
                        minData={minData}
                        maxData={maxData}
                        popoverAperto={popoverBlocco === a.attivitaId}
                        notaBozza={notaBozza}
                        onNotaBozzaChange={setNotaBozza}
                        onClickBarra={() => handleClickBarra(a)}
                        onApriBlocco={() => {
                          setPopoverBlocco(a.attivitaId);
                          setNotaBozza("");
                        }}
                        onChiudiBlocco={() => setPopoverBlocco(null)}
                        onConfermaBlocco={() => confermaBlocco(a.attivitaId)}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RigaAttivita({
  attivita,
  minData,
  maxData,
  popoverAperto,
  notaBozza,
  onNotaBozzaChange,
  onClickBarra,
  onApriBlocco,
  onChiudiBlocco,
  onConfermaBlocco,
}: {
  attivita: AttivitaClienteRow;
  minData: string;
  maxData: string;
  popoverAperto: boolean;
  notaBozza: string;
  onNotaBozzaChange: (v: string) => void;
  onClickBarra: () => void;
  onApriBlocco: () => void;
  onChiudiBlocco: () => void;
  onConfermaBlocco: () => void;
}) {
  const [hover, setHover] = useState(false);
  const info = formatStatoAttivita(attivita.stato);
  const isMilestone = attivita.tipo === "MIL" || attivita.dataInizio === attivita.dataFine;
  const left = pctFor(attivita.dataInizio, minData, maxData);
  const width = Math.max(pctFor(attivita.dataFine, minData, maxData) - left, 0);

  return (
    <div
      className="flex items-center px-5 py-1.5 hover:bg-surface/70 transition-colors relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ width: LABEL_WIDTH }} className="flex-shrink-0 pr-3 min-w-0">
        <p className="text-xs text-ink-900 truncate" title={attivita.descrizione}>
          {attivita.descrizione}
        </p>
        <p className="text-[10px] text-ink-500 truncate">{attivita.responsabile}</p>
      </div>

      <div className="relative flex-1 h-6">
        {isMilestone ? (
          <button
            type="button"
            onClick={onClickBarra}
            className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-white shadow-sm cursor-pointer"
            style={{ left: `${left}%`, background: info.barra }}
            aria-label={`${attivita.descrizione} — ${info.label}`}
          />
        ) : (
          <button
            type="button"
            onClick={onClickBarra}
            className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-md cursor-pointer transition-opacity hover:opacity-80"
            style={{ left: `${left}%`, width: `${width}%`, minWidth: 10, background: info.barra }}
            aria-label={`${attivita.descrizione} — ${info.label}`}
          />
        )}

        {hover && !popoverAperto && (
          <div
            className="pointer-events-none absolute z-20 top-full mt-1 rounded-lg border border-ink-300 bg-surface-card px-3 py-2 text-xs shadow-lg w-64"
            style={{ left: `${Math.min(left, 60)}%` }}
          >
            <p className="font-medium text-ink-900">{attivita.descrizione}</p>
            <p className="text-ink-500 mt-0.5">{attivita.responsabile}</p>
            <p className="text-ink-500 mt-0.5">
              {formatDataBreve(attivita.dataInizio)} – {formatDataBreve(attivita.dataFine)}
            </p>
            <p className="mt-1">
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded ${info.classe}`}>
                {info.label}
              </span>
            </p>
            {attivita.notaTeam && <p className="text-ink-500 mt-1.5 italic">&ldquo;{attivita.notaTeam}&rdquo;</p>}
          </div>
        )}
      </div>

      <div style={{ width: AZIONI_WIDTH }} className="flex-shrink-0 flex justify-center relative">
        {attivita.stato !== "blocked" && (
          <button
            type="button"
            onClick={onApriBlocco}
            title="Segna come bloccata"
            className="text-ink-300 hover:text-red-500 transition-colors"
          >
            <BloccaIcon />
          </button>
        )}

        {popoverAperto && (
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
              <button type="button" onClick={onChiudiBlocco} className="text-[11px] font-medium px-2 py-1 rounded-lg text-ink-500 hover:bg-ink-300/40">
                Annulla
              </button>
              <button
                type="button"
                onClick={onConfermaBlocco}
                disabled={!notaBozza.trim()}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white"
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

function BloccaIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="6.5" y1="17.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

function ChevronIcon({ aperta }: { aperta: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${aperta ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
