"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatNumero, formatPercentuale, formatSettimana } from "@/lib/format";
import { divideOrNull } from "@/lib/kpi";

const HEIGHT = 158;
const HEIGHT_ETICHETTE = 26;
// Spazio sopra il grafico per l'etichetta del tick più alto — vedi lo stesso commento in
// CostoPerRisultatoChart.tsx: il tick massimo (e la barra più alta) cadono a y=0, il testo lì sopra
// sconfinava dal viewBox.
const PAD_TOP = 14;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const MAX_ETICHETTE = 9;
const RAGGIO = 3; // barre con estremità arrotondate ancorate alla base — vedi skill dataviz

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

/** Segmento di barra impilata: angoli arrotondati solo sul bordo ESTERNO (in cima), quello a
 * contatto con un altro segmento sotto/sopra resta dritto — mai due bordi arrotondati che si
 * toccano a metà barra, l'illusione di "due barre separate" invece di una sola impilata. */
function segmentoPath(x: number, yTop: number, larghezza: number, yBase: number, angoliInCima: boolean): string {
  if (!angoliInCima) return `M${x},${yBase} L${x},${yTop} L${x + larghezza},${yTop} L${x + larghezza},${yBase} Z`;
  const r = Math.min(RAGGIO, larghezza / 2, Math.max(0, yBase - yTop));
  if (r <= 0) return `M${x},${yBase} L${x},${yTop} L${x + larghezza},${yTop} L${x + larghezza},${yBase} Z`;
  return (
    `M${x},${yBase} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} ` +
    `L${x + larghezza - r},${yTop} Q${x + larghezza},${yTop} ${x + larghezza},${yTop + r} ` +
    `L${x + larghezza},${yBase} Z`
  );
}

/**
 * Blocco 6d — "Andamento appuntamenti": UNA barra impilata per settimana (non più due barre
 * affiancate) — Effettuati è per costruzione una QUOTA di Fissati (un appuntamento va fissato prima
 * di poter essere effettuato), quindi impilarli invece di affiancarli mostra subito sia il totale
 * (l'altezza intera = Fissati) sia quanti di quelli sono stati portati a termine (il segmento verde
 * in basso), senza dover confrontare due barre vicine a occhio. Scelta pensata anche per il futuro:
 * quando si aggiungerà un confronto per commerciale, una barra impilata regge un numero crescente di
 * segmenti molto meglio di barre affiancate, che si affollano rapidamente.
 *
 * Se i dati (inseriti a mano nel Funnel) danno per una settimana Effettuati > Fissati — non
 * dovrebbe succedere in teoria, ma capita con dati non perfettamente allineati fra loro, stesso
 * caso già visto nel funnel di conversione — la barra mostra comunque l'altezza reale di Effettuati
 * (mai troncata), semplicemente senza il segmento "non ancora effettuati" sopra: un'anomalia nei
 * dati resta visibile, non viene nascosta forzando Effettuati dentro Fissati.
 *
 * Nessuna libreria pura dedicata (a differenza di 6a/6b/6c): consuma trendSettimanale già
 * esteso+overlay-GHL-aware direttamente da KpiSection.tsx, qui c'è solo aritmetica di layout.
 */
export function AndamentoAppuntamentiChart({
  serieSettimanale,
}: {
  serieSettimanale: { settimana: string; appuntamentiFissati: number | null; appuntamentiEffettuati: number | null }[];
}) {
  const [wrapRef, WIDTH] = useLarghezzaContenitore(720);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const punti = useMemo(
    () => serieSettimanale.map((s) => ({ ...s, etichetta: formatSettimana(s.settimana) })),
    [serieSettimanale]
  );

  if (punti.length === 0) {
    return <p className="text-sm text-ink-500">Nessun dato nel periodo selezionato.</p>;
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const groupW = plotW / punti.length;
  // Una sola barra per settimana ora (non più due affiancate): può essere più larga.
  const barW = Math.max(4, Math.min(28, groupW * 0.5));

  const maxValore = Math.max(1, ...punti.map((p) => Math.max(p.appuntamentiFissati ?? 0, p.appuntamentiEffettuati ?? 0))) * 1.15;
  const yFor = (v: number) => HEIGHT - (v / maxValore) * HEIGHT;
  // Set: a valori piccoli due frazioni possono arrotondare allo stesso intero — vedi lo stesso
  // dedupe in CostoPerRisultatoChart.tsx per il bug che altrimenti produce key SVG duplicate.
  const yTicks = Array.from(new Set([0, 0.5, 1].map((f) => Math.round(maxValore * f))));

  const passoEtichette = Math.max(1, Math.ceil(punti.length / MAX_ETICHETTE));
  const active = hoverIndex !== null ? punti[hoverIndex] : null;
  const percentualeEffettuati = active ? divideOrNull(active.appuntamentiEffettuati ?? 0, active.appuntamentiFissati ?? 0) : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const idx = Math.floor((relX / rect.width) * punti.length);
    setHoverIndex(Math.min(punti.length - 1, Math.max(0, idx)));
  }

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-ink-500 mb-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--series-1)", opacity: 0.35 }} />
          Fissati, non ancora effettuati
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--series-3)" }} />
          Effettuati
        </span>
      </div>

      <div className="relative" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${PAD_TOP + HEIGHT + HEIGHT_ETICHETTE}`}
          className="w-full h-auto"
          role="img"
          aria-label="Andamento appuntamenti per settimana: effettuati come quota dei fissati"
        >
        <g transform={`translate(0, ${PAD_TOP})`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(tick)} y2={yFor(tick)} stroke="var(--gridline)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yFor(tick) + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {formatNumero(tick)}
              </text>
            </g>
          ))}

          {punti.map((p, i) => {
            const groupCenter = PAD_LEFT + i * groupW + groupW / 2;
            const fissati = p.appuntamentiFissati ?? 0;
            const effettuati = p.appuntamentiEffettuati ?? 0;
            // Vedi il commento sul componente: mai troncare Effettuati se supera Fissati, l'anomalia
            // resta visibile invece di sparire dentro un valore forzato.
            const cima = Math.max(fissati, effettuati);
            const haResiduo = fissati > effettuati;
            const attivo = hoverIndex === null || hoverIndex === i;
            const x = groupCenter - barW / 2;
            return (
              <g key={p.settimana} opacity={attivo ? 1 : 0.45}>
                {/* Effettuati: sempre il segmento in basso, ancorato alla base — arrotondato in
                    cima solo quando non c'è nessun residuo "fissati non effettuati" sopra di lui. */}
                <path d={segmentoPath(x, yFor(effettuati), barW, HEIGHT, !haResiduo)} fill="var(--series-3)" />
                {/* Fissati non ancora effettuati: il residuo, impilato sopra — sempre lui il bordo
                    esterno arrotondato quando presente. */}
                {haResiduo && <path d={segmentoPath(x, yFor(cima), barW, yFor(effettuati), true)} fill="var(--series-1)" fillOpacity={0.35} />}
              </g>
            );
          })}

          {punti.map((p, i) =>
            i % passoEtichette === 0 ? (
              <text key={p.settimana} x={PAD_LEFT + i * groupW + groupW / 2} y={HEIGHT + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {p.etichetta}
              </text>
            ) : null
          )}

          <rect
            x={PAD_LEFT}
            y={0}
            width={plotW}
            height={HEIGHT}
            fill="transparent"
            tabIndex={0}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
            onFocus={() => setHoverIndex((i) => i ?? 0)}
            onBlur={() => setHoverIndex(null)}
          />
        </g>
        </svg>

        {active && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-ink-300 bg-surface-card px-3 py-2 text-xs shadow-sm"
            style={{ left: `${((PAD_LEFT + hoverIndex * groupW + groupW / 2) / WIDTH) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-medium mb-1 text-ink-500">{active.etichetta}</p>
            <p className="flex items-center gap-1.5 text-ink-900">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--series-1)", opacity: 0.35 }} />
              <strong>{formatNumero(active.appuntamentiFissati)}</strong> fissati
            </p>
            <p className="flex items-center gap-1.5 text-ink-900">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--series-3)" }} />
              <strong>{formatNumero(active.appuntamentiEffettuati)}</strong> effettuati
              {percentualeEffettuati !== null && <span className="text-ink-500"> ({formatPercentuale(percentualeEffettuati)})</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
