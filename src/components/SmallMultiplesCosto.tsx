import type { PuntoSettimanale } from "@/lib/kpiSettimanale";

type SerieSede = { sedeId: string; nome: string; serie: PuntoSettimanale[] };

type MetricaSmallMultiple = {
  chiave: string;
  titolo: string;
  formato: (v: number) => string;
  perSede: SerieSede[];
};

type SmallMultiplesCostoProps = {
  metriche: MetricaSmallMultiple[];
};

// Stessa palette categorica di FunnelStepChart.tsx (--series-1/2/3 restano riservati a
// investimento/fatturato/lead): l'ordine sede->colore va tenuto identico in tutte le viste,
// il chiamante garantisce che `perSede` arrivi sempre nello stesso ordine di sedi.
const COLORI_SEDE = ["var(--series-4)", "var(--series-5)", "var(--series-6)", "var(--series-7)", "var(--series-8)"];

const LARGHEZZA_VIEWBOX = 100;
const ALTEZZA_GRAFICO = 84;
const PADDING_VERTICALE = 4;

type SegmentoPunto = { indice: number; valore: number };

/** Spezza una serie in sotto-tratti continui ai buchi (valore null) — stessa logica di Sparkline.tsx. */
function segmentaSerie(serie: PuntoSettimanale[]): SegmentoPunto[][] {
  const segmenti: SegmentoPunto[][] = [];
  let corrente: SegmentoPunto[] = [];
  serie.forEach((p, indice) => {
    if (p.valore === null) {
      if (corrente.length > 0) {
        segmenti.push(corrente);
        corrente = [];
      }
      return;
    }
    corrente.push({ indice, valore: p.valore });
  });
  if (corrente.length > 0) segmenti.push(corrente);
  return segmenti;
}

/** Un mini-grafico multi-linea (una linea per sede) con scala min/max condivisa fra tutte le sedi della metrica. */
function GraficoMetrica({ perSede, min, max }: { perSede: SerieSede[]; min: number; max: number }) {
  const altezzaUtile = ALTEZZA_GRAFICO - PADDING_VERTICALE * 2;

  const xPer = (indice: number, numeroPunti: number) =>
    numeroPunti === 1 ? LARGHEZZA_VIEWBOX / 2 : (indice / (numeroPunti - 1)) * LARGHEZZA_VIEWBOX;
  const yPer = (valore: number) =>
    min === max ? ALTEZZA_GRAFICO / 2 : PADDING_VERTICALE + altezzaUtile * (1 - (valore - min) / (max - min));

  return (
    <svg
      viewBox={`0 0 ${LARGHEZZA_VIEWBOX} ${ALTEZZA_GRAFICO}`}
      width="100%"
      height={ALTEZZA_GRAFICO}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      {perSede.map((sede, indiceSede) => {
        const colore = COLORI_SEDE[indiceSede % COLORI_SEDE.length];
        const numeroPunti = sede.serie.length;
        const segmenti = segmentaSerie(sede.serie);
        return (
          <g key={sede.sedeId}>
            {segmenti.map((segmento, indiceSegmento) => {
              // Segmento di un solo punto (isolato fra due buchi, o unica settimana con dato) -> puntino.
              const d =
                segmento.length === 1
                  ? `M${xPer(segmento[0].indice, numeroPunti).toFixed(2)},${yPer(segmento[0].valore).toFixed(2)} L${xPer(segmento[0].indice, numeroPunti).toFixed(2)},${yPer(segmento[0].valore).toFixed(2)}`
                  : segmento
                      .map((p, i) => `${i === 0 ? "M" : "L"}${xPer(p.indice, numeroPunti).toFixed(2)},${yPer(p.valore).toFixed(2)}`)
                      .join(" ");
              return (
                <path
                  key={indiceSegmento}
                  d={d}
                  fill="none"
                  stroke={colore}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Griglia di mini-grafici (uno per metrica, es. Costo/Lead, Costo/Appuntamento, Costo/Appuntamento
 * effettuato, CPA) per confrontare fra loro le sedi settimana per settimana. Ogni mini-grafico ha
 * scala propria (min/max calcolati sui valori non-null di TUTTE le sedi per QUELLA metrica): due
 * metriche diverse non sono confrontabili fra loro in valore assoluto, solo l'andamento delle sedi
 * dentro la stessa card lo è. La legenda sede è unica e condivisa in cima alla griglia per non
 * ripetere gli stessi pallini colorati in ogni card.
 */
export function SmallMultiplesCosto({ metriche }: SmallMultiplesCostoProps) {
  if (metriche.length === 0) return null;

  // La legenda si basa sulla prima metrica: il chiamante garantisce lo stesso ordine di sedi
  // (e quindi la stessa corrispondenza sede->colore per indice) in ogni elemento di `metriche`.
  const sediLegenda = metriche[0].perSede;

  return (
    <div>
      {sediLegenda.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs text-ink-500">
          {sediLegenda.map((sede, indice) => (
            <li key={sede.sedeId} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLORI_SEDE[indice % COLORI_SEDE.length] }}
              />
              {sede.nome}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metriche.map((metrica) => {
          const valoriValidi = metrica.perSede.flatMap((sede) =>
            sede.serie.filter((p): p is { settimana: string; valore: number } => p.valore !== null).map((p) => p.valore)
          );
          const haDati = valoriValidi.length > 0;
          const min = haDati ? Math.min(...valoriValidi) : 0;
          const max = haDati ? Math.max(...valoriValidi) : 0;

          return (
            <div key={metrica.chiave} className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full bg-brand" />
                <h3 className="font-heading font-bold text-ink-900 text-[15px]">{metrica.titolo}</h3>
              </div>

              {haDati ? (
                <div className="relative">
                  <div className="absolute top-0 right-0 text-[10px] text-ink-500">{metrica.formato(max)}</div>
                  <div className="absolute bottom-0 right-0 text-[10px] text-ink-500">{metrica.formato(min)}</div>
                  <GraficoMetrica perSede={metrica.perSede} min={min} max={max} />
                </div>
              ) : (
                <div className="flex items-center justify-center text-xs text-ink-500" style={{ height: ALTEZZA_GRAFICO }}>
                  --
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
