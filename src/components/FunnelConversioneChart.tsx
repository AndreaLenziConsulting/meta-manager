"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatNumero, formatPercentuale } from "@/lib/format";
import { costruisciFunnelConversione } from "@/lib/funnelConversione";

const ROW_H = 56;
const GAP = 3; // gap di superficie fra bande impilate — vedi skill dataviz, mai bande a contatto
const HEIGHT = ROW_H * 4 + GAP * 3;
const MIN_FRAC = 0.14; // larghezza minima anche a conversione quasi-zero — mai una banda-filo illeggibile
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
 * Blocco 6a — funnel di conversione: un vero imbuto (trapezi impilati a larghezza decrescente),
 * non barre. Il grafico occupa la metà sinistra del riquadro, le etichette (stadio, conteggio,
 * quota sul primo stadio, conversione allo stadio successivo) stanno a destra invece che scritte
 * dentro le bande colorate — evita il problema del contrasto testo/sfondo che cambierebbe fra
 * tema chiaro e scuro (--funnel-4 è la banda più scura in chiaro ma la più chiara in scuro, vedi
 * il commento sulla rampa in globals.css), e resta leggibile a qualunque larghezza.
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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (numeroLead === 0) {
    return <p className="text-sm text-ink-500">Nessun lead nel periodo selezionato.</p>;
  }

  const stadi = costruisciFunnelConversione({ numeroLead, appuntamentiFissati, appuntamentiEffettuati, numeroVendite });
  const larghezze = stadi.map((s) => Math.max(s.percentualeSuLead ?? 0, MIN_FRAC));

  const funnelW = Math.min(260, WIDTH * 0.4);
  const labelX = funnelW + 28;
  const centroX = funnelW / 2;

  const yTop = (i: number) => i * (ROW_H + GAP);

  return (
    <div ref={wrapRef}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Funnel di conversione: lead, appuntamenti fissati, effettuati, vendite">
        {stadi.map((s, i) => {
          const top = yTop(i);
          const topW = larghezze[i] * funnelW;
          const botW = i < 3 ? larghezze[i + 1] * funnelW : larghezze[i] * funnelW;
          const path = `M${centroX - topW / 2},${top} L${centroX + topW / 2},${top} L${centroX + botW / 2},${top + ROW_H} L${centroX - botW / 2},${top + ROW_H} Z`;
          const attivo = hoverIndex === i;
          return (
            <g
              key={s.stadio}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: "default" }}
            >
              <path d={path} fill={COLORI[i]} opacity={hoverIndex === null || attivo ? 1 : 0.55} />
              <text x={labelX} y={top + 20} fontSize={12} fontWeight={600} fill="var(--text-primary)">
                {s.etichetta}
              </text>
              <text x={labelX} y={top + 38} fontSize={16} fontWeight={700} fill="var(--text-primary)">
                {formatNumero(s.conteggio)}
                {s.percentualeSuLead !== null && (
                  <tspan fontSize={11} fontWeight={400} fill="var(--text-muted)">
                    {"  "}({formatPercentuale(s.percentualeSuLead)} dei lead)
                  </tspan>
                )}
              </text>
              {s.percentualeConversioneAlProssimo !== null && (
                <text x={labelX} y={top + 52} fontSize={10} fill="var(--text-muted)">
                  ↳ {formatPercentuale(s.percentualeConversioneAlProssimo)} converte allo stadio successivo
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
