"use client";

import { useState } from "react";
import { formatEuro, formatMese } from "@/lib/format";

type TrendPoint = { mese: string; investimento: number; fatturato: number };

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 16 };

export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (trend.length === 0) {
    return (
      <div
        className="rounded-xl border p-6 text-sm"
        style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        Nessun dato nel periodo selezionato.
      </div>
    );
  }

  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(1, ...trend.map((t) => Math.max(t.investimento, t.fatturato))) * 1.15;

  const xFor = (i: number) => (trend.length === 1 ? plotW / 2 : (i / (trend.length - 1)) * plotW);
  const yFor = (v: number) => plotH - (v / maxValue) * plotH;

  const pathFor = (key: "investimento" | "fatturato") =>
    trend.map((t, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(t[key])}`).join(" ");

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxValue * f));
  const active = hoverIndex !== null ? trend[hoverIndex] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const idx = Math.round((relX / plotW) * (trend.length - 1));
    setHoverIndex(Math.min(trend.length - 1, Math.max(0, idx)));
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGRectElement>) {
    if (e.key === "ArrowRight") {
      setHoverIndex((i) => Math.min(trend.length - 1, (i ?? -1) + 1));
    } else if (e.key === "ArrowLeft") {
      setHoverIndex((i) => Math.max(0, (i ?? 1) - 1));
    }
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Investimento vs Fatturato
        </h3>
        <ul className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-1)" }} />
            Investimento
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-2)" }} />
            Fatturato
          </li>
        </ul>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Andamento investimento e fatturato per mese">
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {yTicks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={plotW}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="var(--gridline)"
                strokeWidth={1}
              />
            ))}

            <path d={pathFor("investimento")} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={pathFor("fatturato")} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {trend.map((t, i) => (
              <g key={t.mese}>
                <circle cx={xFor(i)} cy={yFor(t.investimento)} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
                <circle cx={xFor(i)} cy={yFor(t.fatturato)} r={4} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
              </g>
            ))}

            {hoverIndex !== null && (
              <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={0} y2={plotH} stroke="var(--baseline)" strokeWidth={1} />
            )}

            {trend.map((t, i) => (
              <text
                key={t.mese}
                x={xFor(i)}
                y={plotH + 18}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-muted)"
              >
                {formatMese(t.mese)}
              </text>
            ))}

            <rect
              x={0}
              y={0}
              width={plotW}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              onMouseMove={handleMove}
              onMouseLeave={() => setHoverIndex(null)}
              onKeyDown={handleKeyDown}
              onFocus={() => setHoverIndex((i) => i ?? 0)}
              onBlur={() => setHoverIndex(null)}
            />
          </g>
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${(PADDING.left + xFor(hoverIndex!)) / WIDTH * 100}%`,
              transform: "translateX(-50%)",
              borderColor: "var(--border-hairline)",
              background: "var(--surface-1)",
            }}
          >
            <p className="font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              {formatMese(active.mese)}
            </p>
            <p className="flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-1)" }} />
              <strong>{formatEuro(active.investimento)}</strong>
            </p>
            <p className="flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-2)" }} />
              <strong>{formatEuro(active.fatturato)}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
