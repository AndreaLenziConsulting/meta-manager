"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatNumero, formatPercentuale } from "@/lib/format";
import { costruisciFunnelConversione } from "@/lib/funnelConversione";
import { divideOrNull } from "@/lib/kpi";

const ROW_H = 64;
const GAP = 3; // gap di superficie fra bande impilate — vedi skill dataviz, mai bande a contatto
const HEIGHT = ROW_H * 4 + GAP * 3;
const MIN_FRAC = 0.16; // larghezza minima proporzionale anche a conversione quasi-zero
// Larghezza minima in PIXEL, non solo proporzionale — nome+numero+percentuale sono scritti dentro
// la banda con lo stesso colore di testo scelto per quella banda (--funnel-N-ink): se la banda è
// più stretta del proprio testo, la parte di testo che sconfina finisce sopra lo sfondo della card
// (bianco/quasi bianco) invece che sopra la banda colorata — e un testo bianco (bande scure) diventa
// invisibile su quello sfondo bianco. Bug osservato dal vivo su "Appuntamenti effettuati" con una
// conversione minima: solo la parte centrale (sopra la banda) restava leggibile. 190px basta per la
// riga più lunga ("Appuntamenti effettuati" a 11px, misurata ~160px) con un margine di sicurezza.
const LARGHEZZA_MIN_PX = 190;
const COLORI = ["var(--funnel-1)", "var(--funnel-2)", "var(--funnel-3)", "var(--funnel-4)"];
const INK = ["var(--funnel-1-ink)", "var(--funnel-2-ink)", "var(--funnel-3-ink)", "var(--funnel-4-ink)"];

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
 * Blocco 6a — funnel di conversione: un vero imbuto (trapezi impilati), nome e numeri scritti
 * DENTRO ciascuna banda (non più in un elenco a lato, come nella prima versione — poco leggibile
 * come "un nome per fase" a colpo d'occhio). Il colore del testo (`INK`) è precalcolato per banda E
 * per tema in globals.css (--funnel-N-ink): --funnel-1/2 sono chiare in chiaro ma le più scure in
 * scuro (vedi il commento sulla rampa lì), un solo colore di testo fisso non basterebbe in entrambi
 * i casi. Tra una banda e la prossima, un'etichetta "converte al successivo" mostra il tasso di
 * abbandono nel punto esatto in cui l'imbuto si restringe. Cliccando una banda si apre un pannello
 * di dettaglio sotto (conteggio esatto, quota sul totale lead, persi rispetto allo stadio
 * precedente, convertiti al successivo) — tutto derivato dagli stessi 4 conteggi già in ingresso,
 * nessun nuovo dato da scaricare.
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

  const funnelW = Math.min(420, WIDTH * 0.72);
  // Larghezza in PIXEL di ogni banda: proporzionale alla quota sul primo stadio, ma mai sotto
  // LARGHEZZA_MIN_PX (vedi sopra) né sopra funnelW stesso (un contenitore molto stretto non può
  // comunque superare la propria larghezza massima disponibile).
  const larghezzePx = stadi.map((s) => Math.min(funnelW, Math.max((s.percentualeSuLead ?? 0) * funnelW, funnelW * MIN_FRAC, LARGHEZZA_MIN_PX)));
  const centroX = WIDTH / 2;
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
            const topW = larghezzePx[i];
            const botW = i < 3 ? larghezzePx[i + 1] : larghezzePx[i];
            const path = `M${centroX - topW / 2},${top} L${centroX + topW / 2},${top} L${centroX + botW / 2},${top + ROW_H} L${centroX - botW / 2},${top + ROW_H} Z`;
            const selezionata = selezionato === i;
            return (
              <g
                key={s.stadio}
                onClick={() => setSelezionato((sel) => (sel === i ? null : i))}
                style={{ cursor: "pointer" }}
                opacity={selezionato === null || selezionata ? 1 : 0.55}
              >
                <path d={path} fill={COLORI[i]} stroke={selezionata ? "var(--text-primary)" : "none"} strokeWidth={selezionata ? 2 : 0} />
                <text x={centroX} y={top + 22} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK[i]} style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {s.etichetta}
                </text>
                <text x={centroX} y={top + 42} textAnchor="middle" fontSize={19} fontWeight={700} fill={INK[i]}>
                  {formatNumero(s.conteggio)}
                </text>
                <text x={centroX} y={top + 57} textAnchor="middle" fontSize={10.5} fill={INK[i]} opacity={0.85}>
                  {s.percentualeSuLead !== null ? `${formatPercentuale(s.percentualeSuLead)} dei lead` : "—"}
                </text>
              </g>
            );
          })}

          {/* Etichetta di conversione fra una banda e la successiva, nel punto esatto in cui
              l'imbuto si restringe — pillola neutra sopra ai trapezi (z-order), leggibile a
              prescindere dal colore delle bande sotto. */}
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

