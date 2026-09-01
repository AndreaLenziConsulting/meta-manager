"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatNumero, formatPercentuale } from "@/lib/format";
import { costruisciFunnelConversione } from "@/lib/funnelConversione";
import { divideOrNull } from "@/lib/kpi";

const ROW_H = 64;
const GAP = 3; // gap di superficie fra bande impilate — vedi skill dataviz, mai bande a contatto
const HEIGHT = ROW_H * 4 + GAP * 3;
// Larghezza minima PROPORZIONALE (non in pixel): le etichette restano fuori dal grafico apposta
// (vedi il commento sul componente sotto), quindi le bande sono libere di restringersi quanto
// serve per rappresentare davvero il calo fra uno stadio e l'altro — un pavimento in pixel come
// nella versione precedente le avrebbe appiattite tutte alla stessa larghezza. 12% resta solo la
// garanzia minima contro una banda-filo invisibile a conversione vicina allo zero.
const MIN_FRAC = 0.12;
const COLORI = ["var(--funnel-1)", "var(--funnel-2)", "var(--funnel-3)", "var(--funnel-4)"];

/** Larghezza reale del contenitore, misurata via ResizeObserver — stesso pattern di TrendChart.tsx. */
function useLarghezzaContenitore(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [larghezza, setLarghezza] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLarghezza(Math.round(el.getBoundingClientRect().width) || fallback);
  }, [fallback]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setLarghezza(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, larghezza];
}

/**
 * Blocco 6a — funnel di conversione: un vero imbuto (trapezi impilati) a sinistra, nome/conteggio/
 * percentuale in un elenco a destra — mai scritti DENTRO le bande: un pavimento in pixel per farceli
 * stare avrebbe reso tutte le bande quasi della stessa larghezza a conversione bassa, perdendo
 * proprio quello che un imbuto deve mostrare a colpo d'occhio (il calo fra uno stadio e l'altro). Un
 * pallino del colore della banda in testa a ogni riga lega comunque etichetta e banda senza
 * ambiguità, anche se sono spazialmente separate. Tra una banda e la prossima, una pillola mostra il
 * tasso di conversione nel punto esatto in cui l'imbuto si restringe. Cliccando una banda O la sua
 * riga (stesso stadio, stesso gestore) si apre un pannello di dettaglio sotto — conteggio esatto,
 * quota sul totale lead, persi rispetto allo stadio precedente, convertiti al successivo — tutto
 * derivato dagli stessi 4 conteggi già in ingresso, nessun nuovo dato da scaricare.
 */
export function FunnelConversioneChart({
  numeroLead,
  appuntamentiFissati,
  appuntamentiEffettuati,
  numeroVendite,
}: {
  numeroLead: number;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  numeroVendite: number;
}) {
  const [wrapRef, WIDTH] = useLarghezzaContenitore(640);
  const [selezionato, setSelezionato] = useState<number | null>(null);

  if (numeroLead === 0) {
    return <p className="text-sm text-ink-500">Nessun lead nel periodo selezionato.</p>;
  }

  const stadi = costruisciFunnelConversione({ numeroLead, appuntamentiFissati, appuntamentiEffettuati, numeroVendite });
  const larghezze = stadi.map((s) => Math.max(s.percentualeSuLead ?? 0, MIN_FRAC));

  // Più stretto di quanto starebbe comodo a schermo intero apposta: l'etichetta più lunga
  // ("Appuntamenti effettuati") ha bisogno di spazio a destra a qualunque larghezza, anche stretta
  // (mobile) — un funnelW troppo generoso lasciava troppo poco spazio e tagliava il testo (bug
  // osservato dal vivo sotto i ~450px di larghezza).
  const funnelW = Math.min(240, WIDTH * 0.34);
  const centroX = funnelW / 2;
  const labelX = funnelW + 28;
  const yTop = (i: number) => i * (ROW_H + GAP);

  const attivo = selezionato !== null ? stadi[selezionato] : null;
  const precedente = selezionato !== null && selezionato > 0 ? stadi[selezionato - 1] : null;
  const successivo = selezionato !== null && selezionato < 3 ? stadi[selezionato + 1] : null;
  const persiVsPrecedente = precedente ? precedente.conteggio - (attivo?.conteggio ?? 0) : null;
  const percPersiVsPrecedente = precedente && attivo ? divideOrNull(persiVsPrecedente ?? 0, precedente.conteggio) : null;

  return (
    <div>
      <div ref={wrapRef}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Funnel di conversione: lead, appuntamenti fissati, effettuati, vendite">
          {stadi.map((s, i) => {
            const top = yTop(i);
            const topW = larghezze[i] * funnelW;
            const botW = i < 3 ? larghezze[i + 1] * funnelW : larghezze[i] * funnelW;
            const path = `M${centroX - topW / 2},${top} L${centroX + topW / 2},${top} L${centroX + botW / 2},${top + ROW_H} L${centroX - botW / 2},${top + ROW_H} Z`;
            const selezionata = selezionato === i;
            const rowCenterY = top + ROW_H / 2;
            return (
              <g
                key={s.stadio}
                onClick={() => setSelezionato((sel) => (sel === i ? null : i))}
                style={{ cursor: "pointer" }}
                opacity={selezionato === null || selezionata ? 1 : 0.45}
              >
                <path d={path} fill={COLORI[i]} stroke={selezionata ? "var(--text-primary)" : "none"} strokeWidth={selezionata ? 2 : 0} />
                {/* Area invisibile a tutta larghezza riga: rende cliccabile anche lo spazio bianco
                    intorno alla banda stretta, non solo il trapezio esatto. */}
                <rect x={0} y={top} width={WIDTH} height={ROW_H} fill="transparent" />

                <circle cx={labelX + 5} cy={rowCenterY - 14} r={5} fill={COLORI[i]} />
                <text x={labelX + 16} y={rowCenterY - 10} fontSize={11} fontWeight={600} fill="var(--text-secondary)" style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {s.etichetta}
                </text>
                <text x={labelX + 16} y={rowCenterY + 12} fontSize={19} fontWeight={700} fill="var(--text-primary)">
                  {formatNumero(s.conteggio)}
                  <tspan fontSize={11} fontWeight={400} fill="var(--text-muted)">
                    {"  "}
                    {s.percentualeSuLead !== null ? `${formatPercentuale(s.percentualeSuLead)} dei lead` : "—"}
                  </tspan>
                </text>
              </g>
            );
          })}

          {/* Etichetta di conversione fra una banda e la successiva, nel punto esatto in cui
              l'imbuto si restringe — pillola neutra sopra ai trapezi (z-order), leggibile a
              prescindere da quanto è stretta la banda sotto. */}
          {stadi.slice(0, 3).map((s, i) => {
            const y = yTop(i + 1);
            const testo = s.percentualeConversioneAlProssimo !== null ? `${formatPercentuale(s.percentualeConversioneAlProssimo)} converte` : "n/d";
            const larghezzaBadge = 18 + testo.length * 5.2;
            return (
              <g key={`conv-${s.stadio}`}>
                <rect x={centroX - larghezzaBadge / 2} y={y - 8} width={larghezzaBadge} height={16} rx={8} fill="var(--surface-1)" stroke="var(--border-hairline)" strokeWidth={1} />
                <text x={centroX} y={y + 3} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--text-secondary)">
                  {testo}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {attivo && (
        <div className="mt-3 rounded-xl border border-ink-300 bg-surface p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-ink-900">{attivo.etichetta}</p>
            <button type="button" onClick={() => setSelezionato(null)} className="text-ink-500 hover:text-ink-700 text-xs cursor-pointer">
              Chiudi ✕
            </button>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <Dettaglio etichetta="Conteggio" valore={formatNumero(attivo.conteggio)} />
            <Dettaglio etichetta="Quota sul totale lead" valore={attivo.percentualeSuLead !== null ? formatPercentuale(attivo.percentualeSuLead) : "—"} />
            {precedente && (
              <Dettaglio
                // Un conteggio più alto dello stadio precedente non dovrebbe succedere in un vero
                // funnel (ogni stadio è un sottoinsieme del precedente) — capita comunque con dati
                // Funnel inseriti a mano non perfettamente allineati fra loro. Mai chiamarlo "persi"
                // quando in realtà è un aumento: fuorvierebbe invece di segnalare l'anomalia.
                etichetta={(persiVsPrecedente ?? 0) >= 0 ? `Persi rispetto a "${precedente.etichetta}"` : `Aumento rispetto a "${precedente.etichetta}"`}
                valore={`${formatNumero(Math.abs(persiVsPrecedente ?? 0))} (${
                  percPersiVsPrecedente !== null ? formatPercentuale(Math.abs(percPersiVsPrecedente)) : "—"
                })`}
              />
            )}
            {successivo && (
              <Dettaglio
                etichetta={`Convertiti a "${successivo.etichetta}"`}
                valore={`${formatNumero(successivo.conteggio)} (${attivo.percentualeConversioneAlProssimo !== null ? formatPercentuale(attivo.percentualeConversioneAlProssimo) : "—"})`}
              />
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

function Dettaglio({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div>
      <dt className="text-ink-500 mb-0.5">{etichetta}</dt>
      <dd className="font-semibold text-ink-900 tabular-nums">{valore}</dd>
    </div>
  );
}
