import type { TesseraSettimanale as TesseraSettimanaleDati } from "@/lib/kpiSettimanale";
import { formatPercentuale } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/Sparkline";
import { DatoNonDisponibile } from "@/components/DatoNonDisponibile";

type TesseraSettimanaleProps = {
  titolo: string;
  tessera: TesseraSettimanaleDati | null;
  formato: (v: number) => string;
  coloreVar?: string;
};

/**
 * Card KPI "settimana corrente" per la tab KPI (nuovo): valore dell'ultima settimana, badge
 * "in corso" se la settimana non è ancora conclusa, delta % rispetto alla settimana precedente
 * (colore sempre neutro: un aumento o un calo non sono di per sé un bene o un male, dipende dalla
 * metrica) e una sparkline delle ultime settimane concluse. Puramente presentazionale — tutto il
 * calcolo vive già in kpiSettimanale.ts.
 */
export function TesseraSettimanale({ titolo, tessera, formato, coloreVar }: TesseraSettimanaleProps) {
  if (tessera === null) {
    return (
      <Card padding="sm" className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">{titolo}</p>
        <DatoNonDisponibile motivo="Nessun dato settimanale disponibile" />
      </Card>
    );
  }

  const { ultimaSettimana, confronto, sparkline } = tessera;

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">{titolo}</p>
        {ultimaSettimana.inCorso && <Badge tono="neutro">In corso</Badge>}
      </div>

      <p className="text-2xl font-semibold text-ink-900">
        {ultimaSettimana.valore === null ? (
          <DatoNonDisponibile motivo="Dato non disponibile per l'ultima settimana" />
        ) : (
          formato(ultimaSettimana.valore)
        )}
      </p>

      <div className="text-xs">
        {confronto === null ? (
          <span className="text-ink-500">dati insufficienti per il confronto</span>
        ) : confronto.deltaPercentuale === null ? (
          <DatoNonDisponibile motivo="Impossibile calcolare la variazione (settimana precedente a zero)" />
        ) : (
          <span className="inline-flex items-center gap-1 text-ink-500">
            <span aria-hidden="true">{confronto.deltaPercentuale >= 0 ? "↑" : "↓"}</span>
            {formatPercentuale(Math.abs(confronto.deltaPercentuale))}
          </span>
        )}
      </div>

      <Sparkline punti={sparkline} coloreVar={coloreVar} />
    </Card>
  );
}
