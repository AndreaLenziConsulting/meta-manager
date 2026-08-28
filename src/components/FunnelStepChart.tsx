"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatPercentuale } from "@/lib/format";
import { percentualeCumulataSuPrimoStadio } from "@/lib/funnelStadi";

type SedeConteggi = { sedeId: string; nome: string; conteggi: [number, number, number] };

// Stessi 3 stadi fissi per ogni sede — l'asse X non dipende dai dati, solo dalla forma del funnel
// (contatto -> presenza -> acquisto), coerente col commento della prop `conteggi` nel piano.
const ETICHETTE_STADI = ["Contatto", "Presenza", "Acquisto"];

// Palette categorica riservata al confronto fra sedi — --series-1/2/3 restano a
// investimento/fatturato/lead nel resto della dashboard, qui si parte da --series-4.
const COLORI_SERIE = [
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

const HEIGHT = 240;
const PAD_TOP = 26; // spazio per l'etichetta % del punto più in alto (100%, sopra al punto)
const PAD_BOTTOM = 30; // spazio per le etichette dei 3 stadi sotto l'asse X
const PAD_LEFT = 44; // etichette dell'asse Y (0%..100%)
const PAD_RIGHT = 34; // l'ultimo stadio ("Acquisto") è ancorato a destra: gli serve margine per non uscire dal viewBox
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

/** Larghezza reale del contenitore via ResizeObserver — vedi stesso pattern/commento in TrendChart.tsx:
 * un viewBox a larghezza fissa renderizzato su un contenitore più largo farebbe scalare oltre misura
 * tutto ciò che è espresso in unità SVG (testo, spessore linee, raggio dei punti). */
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
 * Funnel verticale "a step" per sede, sovrapposto su un'unica scala percentuale condivisa (0%-100%,
 * MAI doppio asse — vedi skill dataviz): ogni sede è una linea che parte da Contatto (100% se ha
 * almeno una richiesta) e mostra quanto arriva a Presenza e Acquisto, per confrontare a colpo d'occhio
 * l'efficienza del funnel fra sedi indipendentemente dal loro volume assoluto.
 */
export function FunnelStepChart({ sedi }: { sedi: SedeConteggi[] }) {
  const [wrapRef, WIDTH] = useLarghezzaContenitore(640);

  const serie = useMemo(
    () =>
      sedi.map((s, i) => ({
        sedeId: s.sedeId,
        nome: s.nome,
        colore: COLORI_SERIE[i % COLORI_SERIE.length],
        percentuali: percentualeCumulataSuPrimoStadio(s.conteggi),
      })),
    [sedi]
  );

  if (sedi.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5">
        <p className="text-sm text-ink-500">Nessuna sede da confrontare.</p>
      </div>
    );
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const xFor = (i: number) => PAD_LEFT + (i / (ETICHETTE_STADI.length - 1)) * plotW;
  const yFor = (v: number) => PAD_TOP + PLOT_HEIGHT - v * PLOT_HEIGHT;

  // Ancoraggio del testo: al centro per lo stadio intermedio, a inizio/fine per i due estremi così
  // le etichette (asse X e valori %) restano dentro al viewBox invece di uscire ai due lati.
  const ancoraPer = (i: number): "start" | "middle" | "end" =>
    i === 0 ? "start" : i === ETICHETTE_STADI.length - 1 ? "end" : "middle";

  // Collega solo i punti con percentuale non-null: "started" (non l'indice) decide M vs L, altrimenti
  // un primo punto nullo (conteggi[0]===0, l'intera serie è null) romperebbe il path.
  const pathFor = (percentuali: (number | null)[]) => {
    let started = false;
    let d = "";
    percentuali.forEach((v, i) => {
      if (v === null) return;
      d += `${started ? "L" : "M"}${xFor(i)},${yFor(v)}`;
      started = true;
    });
    return d;
  };

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-heading font-bold text-ink-900 text-[15px]">Funnel a confronto per sede</h3>
      </div>

      <div ref={wrapRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label="Percentuale cumulata sul primo stadio del funnel (contatto, presenza, acquisto), una linea per sede"
        >
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(t)} y2={yFor(t)} stroke="var(--gridline)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yFor(t) + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {formatPercentuale(t)}
              </text>
            </g>
          ))}

          {ETICHETTE_STADI.map((etichetta, i) => (
            <g key={etichetta}>
              <line x1={xFor(i)} x2={xFor(i)} y1={PAD_TOP} y2={PAD_TOP + PLOT_HEIGHT} stroke="var(--gridline)" strokeWidth={1} strokeDasharray="3,3" />
              <text x={xFor(i)} y={HEIGHT - 10} textAnchor={ancoraPer(i)} fontSize={11} fill="var(--text-muted)">
                {etichetta}
              </text>
            </g>
          ))}

          {serie.map((s) => (
            <path
              key={s.sedeId}
              d={pathFor(s.percentuali)}
              fill="none"
              stroke={s.colore}
              strokeWidth={2}
              strokeOpacity={0.85}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {serie.map((s) => (
            <g key={s.sedeId}>
              {s.percentuali.map((v, i) => {
                if (v === null) return null; // conteggi[0]===0 per questa sede: nessun punto disegnato
                const ancora = ancoraPer(i);
                const dx = ancora === "start" ? 5 : ancora === "end" ? -5 : 0;
                return (
                  <g key={i}>
                    <circle cx={xFor(i)} cy={yFor(v)} r={3.5} fill={s.colore} stroke="var(--surface-1)" strokeWidth={1.5} />
                    <text x={xFor(i) + dx} y={yFor(v) - 8} textAnchor={ancora} fontSize={10} fill={s.colore}>
                      {formatPercentuale(v)}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-ink-500">
        {serie.map((s) => (
          <li key={s.sedeId} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.colore }} />
            {s.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}
