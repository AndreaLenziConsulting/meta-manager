import { cn } from "@/lib/cn";

type PuntoSparkline = { settimana: string; valore: number | null };

type SparklineProps = {
  punti: PuntoSparkline[];
  coloreVar?: string;
  altezza?: number;
  className?: string;
};

/** Larghezza "logica" del viewBox: con `width="100%"` e preserveAspectRatio="none" si adatta al contenitore. */
const LARGHEZZA_VIEWBOX = 100;
/** Margine verticale interno, evita che i tratti (stroke-width 2, cap tondo) vengano tagliati ai bordi del viewBox. */
const PADDING_VERTICALE = 3;

/**
 * Mini-grafico a linea puro (nessun asse/etichetta/griglia) per tessere KPI settimanali — disegnato
 * a mano in SVG, stesso spirito hand-rolled di TrendChart.tsx (linee sottili 2px, cap tondo, colore
 * da variabile CSS della palette --series-N in .viz-root).
 *
 * I punti a valore null creano un'interruzione nella linea: non vengono mai interpolati a 0 né
 * uniti a cavallo del buco. Un punto isolato fra due buchi (o un array con un solo valore) diventa
 * un puntino invece di una linea.
 */
export function Sparkline({ punti, coloreVar = "--series-1", altezza = 32, className }: SparklineProps) {
  const numeroPunti = punti.length;
  const cePuntoValido = punti.some((p) => p.valore !== null);

  if (numeroPunti === 0 || !cePuntoValido) {
    return (
      <div className={cn("flex items-center justify-center text-xs text-ink-500", className)} style={{ height: altezza }}>
        --
      </div>
    );
  }

  const valoriNonNulli = punti.filter((p): p is { settimana: string; valore: number } => p.valore !== null).map((p) => p.valore);
  const min = Math.min(...valoriNonNulli);
  const max = Math.max(...valoriNonNulli);
  const altezzaUtile = altezza - PADDING_VERTICALE * 2;

  const x = (indice: number) => (numeroPunti === 1 ? LARGHEZZA_VIEWBOX / 2 : (indice / (numeroPunti - 1)) * LARGHEZZA_VIEWBOX);
  const y = (valore: number) => (min === max ? altezza / 2 : PADDING_VERTICALE + altezzaUtile * (1 - (valore - min) / (max - min)));

  // Spezza la serie in sotto-tratti continui ai buchi (valore null): ogni sotto-array è una spezzata a sé.
  const segmenti: { indice: number; valore: number }[][] = [];
  let segmentoCorrente: { indice: number; valore: number }[] = [];
  punti.forEach((p, indice) => {
    if (p.valore === null) {
      if (segmentoCorrente.length > 0) {
        segmenti.push(segmentoCorrente);
        segmentoCorrente = [];
      }
      return;
    }
    segmentoCorrente.push({ indice, valore: p.valore });
  });
  if (segmentoCorrente.length > 0) segmenti.push(segmentoCorrente);

  return (
    <svg
      viewBox={`0 0 ${LARGHEZZA_VIEWBOX} ${altezza}`}
      width="100%"
      height={altezza}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-hidden="true"
    >
      {segmenti.map((segmento, indiceSegmento) => {
        // Un segmento di un solo punto (isolato fra due buchi, o unico punto dell'intera serie)
        // diventa un puntino: M seguito da L sullo stesso punto, cap tondo -> un piccolo cerchio pieno.
        const d =
          segmento.length === 1
            ? `M${x(segmento[0].indice).toFixed(2)},${y(segmento[0].valore).toFixed(2)} L${x(segmento[0].indice).toFixed(2)},${y(segmento[0].valore).toFixed(2)}`
            : segmento.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.indice).toFixed(2)},${y(p.valore).toFixed(2)}`).join(" ");
        return (
          <path
            key={indiceSegmento}
            d={d}
            fill="none"
            stroke={`var(${coloreVar})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
