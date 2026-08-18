"use client";

import { useMemo, useState } from "react";
import { formatEuro, formatMese, formatNumero, formatSettimana } from "@/lib/format";
import { Tabs } from "@/components/Tabs";

type TrendMensile = { mese: string; investimento: number; fatturato: number; numeroLead: number };
type TrendSettimanale = { settimana: string; investimento: number; fatturato: number | null; numeroLead: number };
type Punto = { chiave: string; etichetta: string; investimento: number; fatturato: number | null; numeroLead: number };

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 16 };
// Oltre questa soglia le etichette sulle ascisse si accavallano (i punti sono equispaziati,
// quindi uno "step" fisso sull'indice basta — stesso principio di generaTick in RoadmapGantt.tsx).
const MAX_ETICHETTE = 9;

const GRANULARITA_TABS = [
  { id: "mese", label: "Mese" },
  { id: "settimana", label: "Settimana" },
];

const MODALITA_TABS = [
  { id: "valori", label: "Investimento / Fatturato" },
  { id: "lead", label: "Investimento vs Lead" },
];

/**
 * Indicizza una serie a base 100 sul primo valore, per confrontare due grandezze di scala diversa
 * su un solo asse (mai doppio asse: vedi skill dataviz, anti-pattern "dual-axis chart" — la
 * sovrapposizione di due scale arbitrarie inventa una correlazione che non è nei dati).
 * Se il primo valore è zero l'indice non è definibile: tutta la serie torna null (nessuna linea).
 */
function indicizza(valori: number[]): (number | null)[] {
  const base = valori[0];
  if (!base) return valori.map(() => null);
  return valori.map((v) => (v / base) * 100);
}

export function TrendChart({
  trend,
  trendSettimanale,
}: {
  trend: TrendMensile[];
  trendSettimanale: TrendSettimanale[];
}) {
  const [granularita, setGranularita] = useState<"mese" | "settimana">("mese");
  const [modalita, setModalita] = useState<"valori" | "lead">("valori");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const punti: Punto[] = useMemo(() => {
    if (granularita === "settimana") {
      return trendSettimanale.map((t) => ({
        chiave: t.settimana,
        etichetta: formatSettimana(t.settimana),
        investimento: t.investimento,
        fatturato: t.fatturato,
        numeroLead: t.numeroLead,
      }));
    }
    return trend.map((t) => ({
      chiave: t.mese,
      etichetta: formatMese(t.mese),
      investimento: t.investimento,
      fatturato: t.fatturato,
      numeroLead: t.numeroLead,
    }));
  }, [granularita, trend, trendSettimanale]);

  const indiceInvestimento = useMemo(() => indicizza(punti.map((p) => p.investimento)), [punti]);
  const indiceLead = useMemo(() => indicizza(punti.map((p) => p.numeroLead)), [punti]);

  const header = (
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-semibold text-gray-900 text-[15px]">
          {modalita === "lead" ? "Investimento vs Lead acquisiti" : "Investimento vs Fatturato"}
        </h3>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Tabs
          tabs={MODALITA_TABS}
          attivo={modalita}
          onChange={(id) => {
            setModalita(id === "lead" ? "lead" : "valori");
            setHoverIndex(null);
          }}
        />
        <Tabs
          tabs={GRANULARITA_TABS}
          attivo={granularita}
          onChange={(id) => {
            setGranularita(id === "settimana" ? "settimana" : "mese");
            setHoverIndex(null);
          }}
        />
      </div>
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

  const valorePrimario = (i: number) => (modalita === "lead" ? indiceInvestimento[i] : punti[i].investimento);
  const valoreSecondario = (i: number) => (modalita === "lead" ? indiceLead[i] : punti[i].fatturato);

  const maxValue =
    Math.max(1, ...punti.map((_, i) => Math.max(valorePrimario(i) ?? 0, valoreSecondario(i) ?? 0))) * 1.15;

  const xFor = (i: number) => (punti.length === 1 ? plotW / 2 : (i / (punti.length - 1)) * plotW);
  const yFor = (v: number) => plotH - (v / maxValue) * plotH;

  // Costruisce il path collegando solo i punti con valore non nullo: il flag "started" (non l'indice
  // originale) decide M vs L, altrimenti un primo punto nullo romperebbe il path (M mancante).
  const pathFor = (getValue: (i: number) => number | null) => {
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

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxValue * f));
  const active = hoverIndex !== null ? punti[hoverIndex] : null;

  const passoEtichette = Math.max(1, Math.ceil(punti.length / MAX_ETICHETTE));

  const indiceInvestimentoVuoto = modalita === "lead" && indiceInvestimento.every((v) => v === null);
  const indiceLeadVuoto = modalita === "lead" && indiceLead.every((v) => v === null);

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    // rect è il rendering reale (responsive, "w-full") del riquadro di interazione: la sua larghezza
    // a schermo non coincide con plotW (costante in coordinate viewBox) a meno che il contenitore non
    // sia esattamente WIDTH px. Va sempre normalizzato sulla larghezza reale, altrimenti il mapping
    // mouse -> punto deriva silenziosamente ogni volta che il contenitore ha una larghezza diversa.
    const idx = Math.round((relX / rect.width) * (punti.length - 1));
    setHoverIndex(Math.min(punti.length - 1, Math.max(0, idx)));
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGRectElement>) {
    if (e.key === "ArrowRight") {
      setHoverIndex((i) => Math.min(punti.length - 1, (i ?? -1) + 1));
    } else if (e.key === "ArrowLeft") {
      setHoverIndex((i) => Math.max(0, (i ?? 1) - 1));
    }
  }

  const investimentoLabel = modalita === "lead" ? "Investimento (indice)" : "Investimento";
  const secondarioLabel = modalita === "lead" ? "Lead acquisiti (indice)" : "Fatturato";
  const secondarioColore = modalita === "lead" ? "var(--series-3)" : "var(--series-2)";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      {header}

      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <ul className="flex gap-4 text-xs text-gray-500">
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-1)" }} />
            {investimentoLabel}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: secondarioColore }} />
            {secondarioLabel}
          </li>
        </ul>
        {modalita === "lead" ? (
          <span className="text-[11px] text-gray-400">
            {indiceInvestimentoVuoto || indiceLeadVuoto
              ? "Indice non calcolabile: il primo periodo ha valore zero per una delle due serie"
              : "Entrambe le serie = 100 al primo periodo, per confrontare l'andamento"}
          </span>
        ) : (
          granularita === "settimana" && (
            <span className="text-[11px] text-gray-400">
              Fatturato tracciato a livello mensile: il valore si ripete per l&apos;intero mese
            </span>
          )
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Andamento ${investimentoLabel.toLowerCase()} e ${secondarioLabel.toLowerCase()} per ${granularita}`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {yTicks.map((tick) => (
              <line key={tick} x1={0} x2={plotW} y1={yFor(tick)} y2={yFor(tick)} stroke="var(--gridline)" strokeWidth={1} />
            ))}
            {modalita === "lead" && maxValue > 100 && (
              <>
                <line x1={0} x2={plotW} y1={yFor(100)} y2={yFor(100)} stroke="var(--baseline)" strokeWidth={1} />
                <text x={2} y={yFor(100) - 4} fontSize={9} fill="var(--text-muted)">
                  100
                </text>
              </>
            )}

            <path d={pathFor(valorePrimario)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={pathFor(valoreSecondario)} fill="none" stroke={secondarioColore} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {punti.map((p, i) => {
              const vPrimario = valorePrimario(i);
              const vSecondario = valoreSecondario(i);
              return (
                <g key={p.chiave}>
                  {vPrimario !== null && (
                    <circle cx={xFor(i)} cy={yFor(vPrimario)} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
                  )}
                  {vSecondario !== null && (
                    <circle cx={xFor(i)} cy={yFor(vSecondario)} r={4} fill={secondarioColore} stroke="var(--surface-1)" strokeWidth={2} />
                  )}
                </g>
              );
            })}

            {hoverIndex !== null && (
              <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={0} y2={plotH} stroke="var(--baseline)" strokeWidth={1} />
            )}

            {punti.map((p, i) =>
              i % passoEtichette === 0 ? (
                <text key={p.chiave} x={xFor(i)} y={plotH + 18} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                  {p.etichetta}
                </text>
              ) : null
            )}

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

        {active && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${((PADDING.left + xFor(hoverIndex)) / WIDTH) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-medium mb-1 text-gray-500">{active.etichetta}</p>
            <p className="flex items-center gap-1.5 text-gray-900">
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-1)" }} />
              <strong>{formatEuro(active.investimento)}</strong>
              {modalita === "lead" && indiceInvestimento[hoverIndex] !== null && (
                <span className="text-gray-400">(indice {Math.round(indiceInvestimento[hoverIndex]!)})</span>
              )}
            </p>
            {modalita === "lead" ? (
              indiceLead[hoverIndex] !== null && (
                <p className="flex items-center gap-1.5 text-gray-900">
                  <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-3)" }} />
                  <strong>{formatNumero(active.numeroLead)} lead</strong>
                  <span className="text-gray-400">(indice {Math.round(indiceLead[hoverIndex]!)})</span>
                </p>
              )
            ) : (
              active.fatturato !== null && (
                <p className="flex items-center gap-1.5 text-gray-900">
                  <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-2)" }} />
                  <strong>{formatEuro(active.fatturato)}</strong>
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
