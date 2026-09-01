"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatEuro, formatSettimana } from "@/lib/format";
import { calcolaCostoPerRisultatoSettimanale, type PuntoCostoPerRisultato } from "@/lib/costoPerRisultatoSettimanale";

const HEIGHT = 158;
const HEIGHT_ETICHETTE = 26;
// Spazio sopra il grafico per l'etichetta del tick più alto: quel tick cade esattamente a y=0 (il
// massimo asse coincide col bordo superiore del plot), e il testo lì sopra (ascendenti dei
// caratteri, il "3" di offset del baseline) sconfinava oltre il viewBox — tagliato in cima. Senza
// questo padding esplicito, non un problema di zoom/scala: succede sempre, a qualunque larghezza.
const PAD_TOP = 14;
const PAD_LEFT = 56;
const PAD_RIGHT = 56; // simmetrico a PAD_LEFT: qui ospita le etichette dell'asse destro (€/unità)
const MAX_ETICHETTE = 9;

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
 * Blocco 6b — "Costo per Risultato": Spesa (asse sinistro) + Costo per Appuntamento e CAC (asse
 * destro, €/unità), per settimana. UNICO grafico dell'app con doppio asse — scelta consapevole
 * dell'utente nonostante l'anti-pattern (vedi skill dataviz e commento in TrendChart.tsx, che
 * resta l'unico posto dove "mai doppio asse" vale senza eccezioni): qui il punto è leggere
 * l'andamento nel tempo di CIASCUNA linea per conto proprio, mai confrontarne le altezze fra loro
 * — didascalia fissa sotto la legenda lo dice esplicitamente, non solo nel tooltip.
 */
export function CostoPerRisultatoChart({
  serieSettimanale,
}: {
  serieSettimanale: { settimana: string; investimento: number; appuntamentiFissati: number | null; numeroVendite: number | null }[];
}) {
  const [wrapRef, WIDTH] = useLarghezzaContenitore(720);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const punti: (PuntoCostoPerRisultato & { etichetta: string })[] = useMemo(
    () => calcolaCostoPerRisultatoSettimanale(serieSettimanale).map((p) => ({ ...p, etichetta: formatSettimana(p.settimana) })),
    [serieSettimanale]
  );

  if (punti.length === 0) {
    return <p className="text-sm text-ink-500">Nessun dato nel periodo selezionato.</p>;
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const xFor = (i: number) => PAD_LEFT + (punti.length === 1 ? plotW / 2 : (i / (punti.length - 1)) * plotW);

  const maxSpesa = Math.max(1, ...punti.map((p) => p.spesa)) * 1.15;
  const maxUnitario = Math.max(1, ...punti.map((p) => Math.max(p.costoPerAppuntamento ?? 0, p.costoPerVendita ?? 0))) * 1.15;
  const yForSpesa = (v: number) => HEIGHT - (v / maxSpesa) * HEIGHT;
  const yForUnitario = (v: number) => HEIGHT - (v / maxUnitario) * HEIGHT;

  const pathFor = (getValue: (i: number) => number | null, yFor: (v: number) => number) => {
    let started = false;
    let d = "";
    punti.forEach((_, i) => {
      const v = getValue(i);
      if (v === null) return;
      d += `${started ? "L" : "M"}${xFor(i)},${yFor(v)}`;
      started = true;
    });
    return d;
  };

  // Set, non solo .map: a valori piccoli (max vicino al floor di 1) due frazioni possono arrotondare
  // allo stesso intero (es. [0,0.5,1]*1.15 -> 0,1,1) — senza dedupe, due tick con lo stesso valore
  // producevano due elementi SVG con la stessa key React (bug osservato dal vivo).
  const yTicksSpesa = Array.from(new Set([0, 0.5, 1].map((f) => Math.round(maxSpesa * f))));
  const yTicksUnitario = Array.from(new Set([0, 0.5, 1].map((f) => Math.round(maxUnitario * f))));
  const passoEtichette = Math.max(1, Math.ceil(punti.length / MAX_ETICHETTE));
  const active = hoverIndex !== null ? punti[hoverIndex] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const idx = Math.round((relX / rect.width) * (punti.length - 1));
    setHoverIndex(Math.min(punti.length - 1, Math.max(0, idx)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <ul className="flex gap-4 text-xs text-ink-500 flex-wrap">
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-1)" }} />
            Spesa pubblicitaria (asse sx)
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-4)" }} />
            Costo per Appuntamento (asse dx)
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-7)" }} />
            CAC (asse dx)
          </li>
        </ul>
      </div>
      <p className="text-[11px] text-ink-500 mb-2">
        Due assi con scale diverse (€ totali a sinistra, €/unità a destra): leggi l&apos;andamento di ogni linea nel tempo, non confrontare le
        altezze fra linee diverse.
      </p>

      <div className="relative" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${PAD_TOP + HEIGHT + HEIGHT_ETICHETTE}`}
          className="w-full h-auto"
          role="img"
          aria-label="Costo per risultato per settimana: spesa pubblicitaria, costo per appuntamento e CAC"
        >
        <g transform={`translate(0, ${PAD_TOP})`}>
          {yTicksSpesa.map((tick) => (
            <g key={`sx-${tick}`}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yForSpesa(tick)} y2={yForSpesa(tick)} stroke="var(--gridline)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yForSpesa(tick) + 3} textAnchor="end" fontSize={10} fill="var(--series-1)">
                {formatEuro(tick)}
              </text>
            </g>
          ))}
          {yTicksUnitario.map((tick) => (
            <text key={`dx-${tick}`} x={WIDTH - PAD_RIGHT + 8} y={yForUnitario(tick) + 3} textAnchor="start" fontSize={10} fill="var(--text-muted)">
              {formatEuro(tick)}
            </text>
          ))}

          <path d={pathFor((i) => punti[i].spesa, yForSpesa)} fill="none" stroke="var(--series-1)" strokeOpacity={0.85} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathFor((i) => punti[i].costoPerAppuntamento, yForUnitario)} fill="none" stroke="var(--series-4)" strokeOpacity={0.85} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathFor((i) => punti[i].costoPerVendita, yForUnitario)} fill="none" stroke="var(--series-7)" strokeOpacity={0.85} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {punti.map((p, i) => (
            <g key={p.settimana}>
              <circle cx={xFor(i)} cy={yForSpesa(p.spesa)} r={3} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={1.5} />
              {p.costoPerAppuntamento !== null && (
                <circle cx={xFor(i)} cy={yForUnitario(p.costoPerAppuntamento)} r={3} fill="var(--series-4)" stroke="var(--surface-1)" strokeWidth={1.5} />
              )}
              {p.costoPerVendita !== null && (
                <circle cx={xFor(i)} cy={yForUnitario(p.costoPerVendita)} r={3} fill="var(--series-7)" stroke="var(--surface-1)" strokeWidth={1.5} />
              )}
            </g>
          ))}

          {hoverIndex !== null && <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={0} y2={HEIGHT} stroke="var(--baseline)" strokeWidth={1} />}

          {punti.map((p, i) =>
            i % passoEtichette === 0 ? (
              <text key={p.settimana} x={xFor(i)} y={HEIGHT + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
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
            style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-medium mb-1 text-ink-500">{active.etichetta}</p>
            <p className="flex items-center gap-1.5 text-ink-900">
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-1)" }} />
              <strong>{formatEuro(active.spesa)}</strong> <span className="text-ink-500">spesa (asse sx)</span>
            </p>
            <p className="flex items-center gap-1.5 text-ink-900">
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-4)" }} />
              <strong>{formatEuro(active.costoPerAppuntamento)}</strong> <span className="text-ink-500">costo/appuntamento (asse dx)</span>
            </p>
            <p className="flex items-center gap-1.5 text-ink-900">
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-7)" }} />
              <strong>{formatEuro(active.costoPerVendita)}</strong> <span className="text-ink-500">CAC (asse dx)</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
