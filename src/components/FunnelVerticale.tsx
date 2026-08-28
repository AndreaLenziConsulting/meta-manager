import type { StadioFunnel } from "@/lib/funnelStadi";
import { formatEuro, formatNumero, formatPercentuale } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { DatoNonDisponibile } from "@/components/DatoNonDisponibile";

// Opacità decrescente stadio per stadio sulla stessa var(--series-1) (riservata a "investimento",
// coerente con TrendChart/KpiDashboard) — una sola tinta che si affievolisce comunica l'ordine del
// funnel senza introdurre colori nuovi che andrebbero letti come categorie diverse.
const OPACITA_BARRA = [1, 0.78, 0.58, 0.4];
// Larghezza minima visibile anche quando conteggio = 0 (o stadi[0].conteggio = 0): altrimenti la
// barra sparirebbe del tutto e sembrerebbe un errore di rendering invece che "zero".
const LARGHEZZA_MINIMA_PCT = 3;

export function FunnelVerticale({ stadi }: { stadi: StadioFunnel[] }) {
  const base = stadi[0]?.conteggio ?? 0;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-heading font-bold text-ink-900 text-[15px]">Funnel</h3>
      </div>

      <div className="flex flex-col">
        {stadi.map((s, i) => {
          const larghezzaPct = base > 0 ? Math.max((s.conteggio / base) * 100, LARGHEZZA_MINIMA_PCT) : LARGHEZZA_MINIMA_PCT;
          const prossimo = stadi[i + 1];

          return (
            <div key={s.stadio}>
              <div className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-sm text-ink-700">{s.etichetta}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-7 rounded-md bg-ink-300/25 overflow-hidden">
                    <div
                      className="h-full rounded-md"
                      style={{ width: `${larghezzaPct}%`, background: "var(--series-1)", opacity: OPACITA_BARRA[i] ?? 0.4 }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {s.costoCumulato !== null ? (
                      <>{formatEuro(s.costoCumulato)} a persona (cumulato)</>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <DatoNonDisponibile motivo="Costo cumulato non calcolabile: nessuno ha raggiunto questo stadio" /> costo cumulato
                      </span>
                    )}
                  </p>
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-900">
                  {formatNumero(s.conteggio)}
                </span>
              </div>

              {prossimo && (
                <div className="flex items-center gap-2 pl-40 py-2 text-xs text-ink-500">
                  <span className="inline-block w-px h-4 bg-ink-300 ml-[15px]" aria-hidden="true" />
                  <span className="flex items-center gap-1.5">
                    {s.percentualeConversioneAlProssimo !== null ? (
                      <span className="font-medium text-ink-700">{formatPercentuale(s.percentualeConversioneAlProssimo)}</span>
                    ) : (
                      <DatoNonDisponibile motivo="Percentuale di conversione non calcolabile" />
                    )}
                    <span>prosegue —</span>
                    {s.dropOffAssoluto !== null ? (
                      <span>{formatNumero(s.dropOffAssoluto)} non arrivano al passaggio successivo</span>
                    ) : (
                      <DatoNonDisponibile motivo="Numero di persone perse non calcolabile" />
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
