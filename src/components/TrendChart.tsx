"use client";

import { useMemo, useState } from "react";
import { formatEuro, formatMese, formatSettimana } from "@/lib/format";
import { Tabs } from "@/components/Tabs";

type TrendMensile = { mese: string; investimento: number; fatturato: number };
type TrendSettimanale = { settimana: string; investimento: number };
type Punto = { chiave: string; etichetta: string; investimento: number; fatturato: number | null };

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 16 };

const GRANULARITA_TABS = [
  { id: "mese", label: "Mese" },
  { id: "settimana", label: "Settimana" },
];

export function TrendChart({
  trend,
  trendSettimanale,
}: {
  trend: TrendMensile[];
  trendSettimanale: TrendSettimanale[];
}) {
  const [granularita, setGranularita] = useState<"mese" | "settimana">("mese");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const punti: Punto[] = useMemo(() => {
    if (granularita === "settimana") {
      return trendSettimanale.map((t) => ({
        chiave: t.settimana,
        etichetta: formatSettimana(t.settimana),
        investimento: t.investimento,
        fatturato: null,
      }));
    }
    return trend.map((t) => ({
      chiave: t.mese,
      etichetta: formatMese(t.mese),
      investimento: t.investimento,
      fatturato: t.fatturato,
    }));
  }, [granularita, trend, trendSettimanale]);

  const header = (
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-semibold text-gray-900 text-[15px]">Investimento vs Fatturato</h3>
      </div>
      <Tabs
        tabs={GRANULARITA_TABS}
        attivo={granularita}
        onChange={(id) => {
          setGranularita(id === "settimana" ? "settimana" : "mese");
          setHoverIndex(null);
        }}
      />
    </div>
  );

  if (punti.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        {header}
        <p className="text-sm text-gray-500">Nessun dato nel periodo selezionato.</p>
      </div>
    );
  }

  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(1, ...punti.map((p) => Math.max(p.investimento, p.fatturato ?? 0))) * 1.15;

  const xFor = (i: number) => (punti.length === 1 ? plotW / 2 : (i / (punti.length - 1)) * plotW);
  const yFor = (v: number) => plotH - (v / maxValue) * plotH;

  const pathFor = (key: "investimento" | "fatturato") =>
    punti
      .map((p, i) => {
        const v = p[key];
        return v === null ? null : `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`;
      })
      .filter(Boolean)
      .join(" ");

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxValue * f));
  const active = hoverIndex !== null ? punti[hoverIndex] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const idx = Math.round((relX / plotW) * (punti.length - 1));
    setHoverIndex(Math.min(punti.length - 1, Math.max(0, idx)));
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGRectElement>) {
    if (e.key === "ArrowRight") {
      setHoverIndex((i) => Math.min(punti.length - 1, (i ?? -1) + 1));
    } else if (e.key === "ArrowLeft") {
      setHoverIndex((i) => Math.max(0, (i ?? 1) - 1));
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      {header}

      <div className="flex items-center justify-between mb-2">
        <ul className="flex gap-4 text-xs text-gray-500">
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-1)" }} />
            Investimento
          </li>
          {granularita === "mese" && (
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-2)" }} />
              Fatturato
            </li>
          )}
        </ul>
        {granularita === "settimana" && (
          <span className="text-[11px] text-gray-400">Fatturato disponibile solo a livello mensile</span>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Andamento investimento${granularita === "mese" ? " e fatturato" : ""} per ${granularita}`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {yTicks.map((tick) => (
              <line key={tick} x1={0} x2={plotW} y1={yFor(tick)} y2={yFor(tick)} stroke="var(--gridline)" strokeWidth={1} />
            ))}

            <path d={pathFor("investimento")} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {granularita === "mese" && (
              <path d={pathFor("fatturato")} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}

            {punti.map((p, i) => (
              <g key={p.chiave}>
                <circle cx={xFor(i)} cy={yFor(p.investimento)} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
                {p.fatturato !== null && (
                  <circle cx={xFor(i)} cy={yFor(p.fatturato)} r={4} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
                )}
              </g>
            ))}

            {hoverIndex !== null && (
              <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={0} y2={plotH} stroke="var(--baseline)" strokeWidth={1} />
            )}

            {punti.map((p, i) => (
              <text key={p.chiave} x={xFor(i)} y={plotH + 18} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {p.etichetta}
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
            className="pointer-events-none absolute top-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${((PADDING.left + xFor(hoverIndex!)) / WIDTH) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-medium mb-1 text-gray-500">{active.etichetta}</p>
            <p className="flex items-center gap-1.5 text-gray-900">
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-1)" }} />
              <strong>{formatEuro(active.investimento)}</strong>
            </p>
            {active.fatturato !== null && (
              <p className="flex items-center gap-1.5 text-gray-900">
                <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-2)" }} />
                <strong>{formatEuro(active.fatturato)}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
