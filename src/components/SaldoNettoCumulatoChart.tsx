"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatEuro, formatSettimana } from "@/lib/format";
import { calcolaSaldoNettoCumulato, type PuntoSaldoNetto } from "@/lib/saldoNettoCumulato";

const HEIGHT = 158;
const HEIGHT_ETICHETTE = 26;
const PAD_LEFT = 64;
const PAD_RIGHT = 12;
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
 * Blocco 6c — "Saldo netto cumulato": UNA sola linea (fatturato cumulato − investimento cumulato,
 * da `primaData` della sede — vedi calcolaSaldoNettoCumulato) invece delle due linee separate di
 * TrendChart.tsx (non toccato). Riempimento diverso sopra/sotto lo zero (verde = in attivo, rosso
 * = in perdita) — uso legittimo dei colori di stato qui: "sopra/sotto zero" è un vero stato, non
 * un'identità di serie (vedi il commento su --pos/--neg in globals.css). La linea stessa resta un
 * colore neutro: il colore che porta il significato è il riempimento, non la linea.
 */
export function SaldoNettoCumulatoChart({
  serieDaSempre,
}: {
  serieDaSempre: { settimana: string; investimento: number; fatturato: number | null }[];
}) {
  const [wrapRef, WIDTH] = useLarghezzaContenitore(720);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // useId (non Math.random): stabile fra render server e client, niente hydration mismatch
  // sull'id del clipPath — due grafici sulla stessa pagina restano comunque senza collisioni di id.
  // Chiamato qui (prima dell'eventuale return sotto): le regole degli Hook non permettono un return
  // anticipato fra due Hook.
  const clipId = useId();

  const punti: (PuntoSaldoNetto & { etichetta: string })[] = useMemo(
    () => calcolaSaldoNettoCumulato(serieDaSempre).map((p) => ({ ...p, etichetta: formatSettimana(p.settimana) })),
    [serieDaSempre]
  );

  if (punti.length === 0) {
    return <p className="text-sm text-ink-500">Nessun dato disponibile.</p>;
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const xFor = (i: number) => PAD_LEFT + (punti.length === 1 ? plotW / 2 : (i / (punti.length - 1)) * plotW);

  const valori = punti.map((p) => p.saldoNetto);
  const yMax = Math.max(1, ...valori) * 1.15;
  const yMin = Math.min(-1, ...valori) * 1.15;
  const range = yMax - yMin;
  const yFor = (v: number) => HEIGHT - ((v - yMin) / range) * HEIGHT;
  const yZero = yFor(0);

  const linePath = punti.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.saldoNetto)}`).join("");
  const areaPath = `M${xFor(0)},${yZero} ${punti.map((p, i) => `L${xFor(i)},${yFor(p.saldoNetto)}`).join(" ")} L${xFor(punti.length - 1)},${yZero} Z`;

  // Dedupe non solo per valore ma per posizione in pixel: quando il minimo storico è piccolo
  // rispetto al massimo (es. una sede quasi sempre in attivo, con un solo breve periodo iniziale
  // leggermente sotto zero), il tick "yMin" e il tick "0" cadono a pochi px l'uno dall'altro e le
  // etichette si sovrappongono illeggibili — osservato dal vivo. Priorità a 0 (la linea di
  // pareggio, il riferimento che conta di più in questo grafico) e a yMax, yMin cede il passo se
  // troppo vicino a un tick già scelto.
  const MIN_PX_TRA_TICK = 14;
  const yTicks: number[] = [];
  const yPxUsati: number[] = [];
  for (const v of [0, yMax, yMin + range * 0.5, yMin]) {
    const y = yFor(v);
    if (yPxUsati.some((yu) => Math.abs(yu - y) < MIN_PX_TRA_TICK)) continue;
    yTicks.push(v);
    yPxUsati.push(y);
  }
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
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <ul className="flex gap-4 text-xs text-ink-500">
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--pos)" }} />
            In attivo (fatturato &gt; investimento, da sempre)
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--neg)" }} />
            In perdita
          </li>
        </ul>
        <span className="text-[11px] text-ink-500">Da inizio collaborazione, non dal periodo filtrato sopra</span>
      </div>

      <div className="relative" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT + HEIGHT_ETICHETTE}`}
          className="w-full h-auto"
          role="img"
          aria-label="Saldo netto cumulato per settimana: fatturato cumulato meno investimento cumulato, da sempre"
        >
          <defs>
            <clipPath id={`${clipId}-pos`}>
              <rect x={0} y={0} width={WIDTH} height={Math.max(0, yZero)} />
            </clipPath>
            <clipPath id={`${clipId}-neg`}>
              <rect x={0} y={yZero} width={WIDTH} height={Math.max(0, HEIGHT - yZero)} />
            </clipPath>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(tick)} y2={yFor(tick)} stroke={tick === 0 ? "var(--baseline)" : "var(--gridline)"} strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yFor(tick) + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {formatEuro(tick)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="var(--pos)" fillOpacity={0.15} clipPath={`url(#${clipId}-pos)`} />
          <path d={areaPath} fill="var(--neg)" fillOpacity={0.15} clipPath={`url(#${clipId}-neg)`} />
          <path d={linePath} fill="none" stroke="var(--text-primary)" strokeOpacity={0.75} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {punti.map((p, i) => (
            <circle
              key={p.settimana}
              cx={xFor(i)}
              cy={yFor(p.saldoNetto)}
              r={3}
              fill={p.saldoNetto >= 0 ? "var(--pos)" : "var(--neg)"}
              stroke="var(--surface-1)"
              strokeWidth={1.5}
            />
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
        </svg>

        {active && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-ink-300 bg-surface-card px-3 py-2 text-xs shadow-sm"
            style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-medium mb-1 text-ink-500">{active.etichetta}</p>
            <p className="text-ink-900">
              Saldo netto:{" "}
              <strong style={{ color: active.saldoNetto >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatEuro(active.saldoNetto)}</strong>
            </p>
            <p className="text-ink-500">Investimento cumulato: {formatEuro(active.investimentoCumulato)}</p>
            <p className="text-ink-500">Fatturato cumulato: {formatEuro(active.fatturatoCumulato)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
