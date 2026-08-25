"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatEuro, formatMese, formatNumero, formatSettimana } from "@/lib/format";
import { Tabs } from "@/components/Tabs";

type TrendSettimanale = { settimana: string; investimento: number; fatturato: number | null; numeroLead: number };
type Punto = { chiave: string; etichetta: string; investimento: number; fatturato: number | null; numeroLead: number };

// Solo la LARGHEZZA è misurata sul contenitore reale (vedi useLarghezzaContenitore) — l'altezza
// resta fissa. Senza questa misura, un viewBox a larghezza costante (es. 720) reso su un
// contenitore molto più largo (desktop, contenitori max-w-screen-2xl) fa scalare *tutto* ciò che è
// espresso in "unità SVG" — testo, spessore linee, raggio dei punti — ben oltre le dimensioni reali
// in px che il resto della pagina usa: è esattamente il bug delle etichette "enormi" sulle ascisse.
// Misurando la larghezza reale, 1 unità di viewBox = 1px reale, sempre, a qualunque larghezza.
const HEIGHT_PRINCIPALE = 158;
const GAP_STRISCIA = 10;
const HEIGHT_STRISCIA = 46;
const HEIGHT_ETICHETTE = 26;
const HEIGHT = HEIGHT_PRINCIPALE + GAP_STRISCIA + HEIGHT_STRISCIA + HEIGHT_ETICHETTE;
const PAD_LEFT = 56; // ospita le etichette delle ordinate (prima assenti — vedi feedback)
const PAD_RIGHT = 12;
const MAX_ETICHETTE = 9;

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

/** Larghezza reale del contenitore, misurata via ResizeObserver — vedi commento sopra HEIGHT. */
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

export function TrendChart({ trendSettimanale }: { trendSettimanale: TrendSettimanale[] }) {
  const [modalita, setModalita] = useState<"valori" | "lead">("valori");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [wrapRef, WIDTH] = useLarghezzaContenitore(720);

  const punti: Punto[] = useMemo(
    () =>
      trendSettimanale.map((t) => ({
        chiave: t.settimana,
        etichetta: formatSettimana(t.settimana),
        investimento: t.investimento,
        fatturato: t.fatturato,
        numeroLead: t.numeroLead,
      })),
    [trendSettimanale]
  );

  // Righe verticali che segnano l'inizio di ogni mese — la vista è sempre a settimana, ma i mesi
  // restano un riferimento utile: senza il selettore Mese/Settimana di prima, sono l'unico modo di
  // orientarsi su "che mese è" scorrendo le etichette di settimana (es. "24 Lug").
  const confiniMese = useMemo(() => {
    const confini: { indice: number; etichetta: string }[] = [];
    punti.forEach((p, i) => {
      const mese = p.chiave.slice(0, 7);
      const mesePrecedente = i > 0 ? punti[i - 1].chiave.slice(0, 7) : null;
      if (mese !== mesePrecedente) confini.push({ indice: i, etichetta: formatMese(mese).split(" ")[0] });
    });
    return confini;
  }, [punti]);

  const indiceInvestimento = useMemo(() => indicizza(punti.map((p) => p.investimento)), [punti]);
  const indiceLead = useMemo(() => indicizza(punti.map((p) => p.numeroLead)), [punti]);

  const header = (
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-heading font-bold text-ink-900 text-[15px]">
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
      </div>
    </div>
  );

  if (punti.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5">
        {header}
        <p className="text-sm text-ink-500">Nessun dato nel periodo selezionato.</p>
      </div>
    );
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;

  const valorePrimario = (i: number) => (modalita === "lead" ? indiceInvestimento[i] : punti[i].investimento);
  const valoreSecondario = (i: number) => (modalita === "lead" ? indiceLead[i] : punti[i].fatturato);

  const maxValorePrincipale =
    Math.max(1, ...punti.map((_, i) => Math.max(valorePrimario(i) ?? 0, valoreSecondario(i) ?? 0))) * 1.15;
  const maxLead = Math.max(1, ...punti.map((p) => p.numeroLead)) * 1.15;

  const xFor = (i: number) => PAD_LEFT + (punti.length === 1 ? plotW / 2 : (i / (punti.length - 1)) * plotW);
  const yForPrincipale = (v: number) => HEIGHT_PRINCIPALE - (v / maxValorePrincipale) * HEIGHT_PRINCIPALE;
  const stripTop = HEIGHT_PRINCIPALE + GAP_STRISCIA;
  const yForStriscia = (v: number) => stripTop + HEIGHT_STRISCIA - (v / maxLead) * HEIGHT_STRISCIA;

  // Costruisce il path collegando solo i punti con valore non nullo: il flag "started" (non l'indice
  // originale) decide M vs L, altrimenti un primo punto nullo romperebbe il path (M mancante).
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

  const formatTick = (v: number) => (modalita === "lead" ? formatNumero(v) : formatEuro(v));
  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxValorePrincipale * f));
  const active = hoverIndex !== null ? punti[hoverIndex] : null;

  const passoEtichette = Math.max(1, Math.ceil(punti.length / MAX_ETICHETTE));

  const indiceInvestimentoVuoto = modalita === "lead" && indiceInvestimento.every((v) => v === null);
  const indiceLeadVuoto = modalita === "lead" && indiceLead.every((v) => v === null);

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    // rect è il rendering reale (responsive, "w-full") del riquadro di interazione: la sua larghezza
    // a schermo non coincide con plotW se il contenitore misurato non è ancora aggiornato nello
    // stesso istante — va sempre normalizzato sulla larghezza reale, non su plotW.
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
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5">
      {header}

      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <ul className="flex gap-4 text-xs text-ink-500">
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-1)" }} />
            {investimentoLabel}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: secondarioColore }} />
            {secondarioLabel}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--series-3)" }} />
            Lead acquisiti
          </li>
        </ul>
        {modalita === "lead" ? (
          <span className="text-[11px] text-ink-500">
            {indiceInvestimentoVuoto || indiceLeadVuoto
              ? "Indice non calcolabile: il primo periodo ha valore zero per una delle due serie"
              : "Entrambe le serie = 100 al primo periodo, per confrontare l'andamento"}
          </span>
        ) : (
          <span className="text-[11px] text-ink-500">
            Fatturato tracciato a livello mensile: il valore si ripete per l&apos;intero mese
          </span>
        )}
      </div>

      <div className="relative" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Andamento ${investimentoLabel.toLowerCase()}, ${secondarioLabel.toLowerCase()} e lead acquisiti per settimana`}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yForPrincipale(tick)} y2={yForPrincipale(tick)} stroke="var(--gridline)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yForPrincipale(tick) + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {modalita === "lead" && maxValorePrincipale > 100 && (
            <>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yForPrincipale(100)} y2={yForPrincipale(100)} stroke="var(--baseline)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yForPrincipale(100) - 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">
                100
              </text>
            </>
          )}

          {/* Confini mese: tratteggiate e recessive, sotto ai dati (vedi skill dataviz — grid/assi
              recessivi) — segnano la struttura, non devono competere con le due serie. */}
          {confiniMese.map((c) => (
            <g key={c.indice}>
              <line
                x1={xFor(c.indice)}
                x2={xFor(c.indice)}
                y1={0}
                y2={stripTop + HEIGHT_STRISCIA}
                stroke="var(--gridline)"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <text x={xFor(c.indice) + 4} y={10} fontSize={9} fill="var(--text-muted)">
                {c.etichetta}
              </text>
            </g>
          ))}

          {/* Linee principali leggermente meno satura/opache: i punti (sotto) restano a piena opacità
              e portano il valore esatto — la linea deve suggerire l'andamento, non "gridare". */}
          <path d={pathFor(valorePrimario, yForPrincipale)} fill="none" stroke="var(--series-1)" strokeOpacity={0.82} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathFor(valoreSecondario, yForPrincipale)} fill="none" stroke={secondarioColore} strokeOpacity={0.82} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {punti.map((p, i) => {
            const vPrimario = valorePrimario(i);
            const vSecondario = valoreSecondario(i);
            return (
              <g key={p.chiave}>
                {vPrimario !== null && (
                  <circle cx={xFor(i)} cy={yForPrincipale(vPrimario)} r={3.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={1.5} />
                )}
                {vSecondario !== null && (
                  <circle cx={xFor(i)} cy={yForPrincipale(vSecondario)} r={3.5} fill={secondarioColore} stroke="var(--surface-1)" strokeWidth={1.5} />
                )}
              </g>
            );
          })}

          {/* Striscia "quantità" — Lead acquisiti, sempre visibile indipendentemente dalla modalità:
              scala propria, piccola e in secondo piano, per non competere con le due serie in €. */}
          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={stripTop + HEIGHT_STRISCIA} y2={stripTop + HEIGHT_STRISCIA} stroke="var(--gridline)" strokeWidth={1} />
          <text x={PAD_LEFT - 8} y={stripTop + 9} textAnchor="end" fontSize={9} fill="var(--text-muted)">
            {formatNumero(Math.round(maxLead / 1.15))}
          </text>
          <path
            d={`${pathFor((i) => punti[i].numeroLead, yForStriscia)} L${xFor(punti.length - 1)},${stripTop + HEIGHT_STRISCIA} L${xFor(0)},${stripTop + HEIGHT_STRISCIA} Z`}
            fill="var(--series-3)"
            fillOpacity={0.1}
            stroke="none"
          />
          <path d={pathFor((i) => punti[i].numeroLead, yForStriscia)} fill="none" stroke="var(--series-3)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

          {hoverIndex !== null && (
            <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={0} y2={stripTop + HEIGHT_STRISCIA} stroke="var(--baseline)" strokeWidth={1} />
          )}

          {punti.map((p, i) =>
            i % passoEtichette === 0 ? (
              <text key={p.chiave} x={xFor(i)} y={stripTop + HEIGHT_STRISCIA + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {p.etichetta}
              </text>
            ) : null
          )}

          <rect
            x={PAD_LEFT}
            y={0}
            width={plotW}
            height={stripTop + HEIGHT_STRISCIA}
            fill="transparent"
            tabIndex={0}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
            onKeyDown={handleKeyDown}
            onFocus={() => setHoverIndex((i) => i ?? 0)}
            onBlur={() => setHoverIndex(null)}
          />
        </svg>

        {active && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-ink-300 bg-surface-card px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-medium mb-1 text-ink-500">{active.etichetta}</p>
            <p className="flex items-center gap-1.5 text-ink-900">
              <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-1)" }} />
              <strong>{formatEuro(active.investimento)}</strong>
              {modalita === "lead" && indiceInvestimento[hoverIndex] !== null && (
                <span className="text-ink-500">(indice {Math.round(indiceInvestimento[hoverIndex]!)})</span>
              )}
            </p>
            {modalita === "lead" ? (
              indiceLead[hoverIndex] !== null && (
                <p className="flex items-center gap-1.5 text-ink-900">
                  <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-3)" }} />
                  <strong>{formatNumero(active.numeroLead)} lead</strong>
                  <span className="text-ink-500">(indice {Math.round(indiceLead[hoverIndex]!)})</span>
                </p>
              )
            ) : (
              active.fatturato !== null && (
                <p className="flex items-center gap-1.5 text-ink-900">
                  <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-2)" }} />
                  <strong>{formatEuro(active.fatturato)}</strong>
                </p>
              )
            )}
            {modalita === "valori" && (
              <p className="flex items-center gap-1.5 text-ink-900">
                <span className="inline-block w-2.5 h-0.5" style={{ background: "var(--series-3)" }} />
                <strong>{formatNumero(active.numeroLead)} lead</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
