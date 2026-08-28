import { divideOrNull } from "@/lib/kpi";

/**
 * Blocco di calcolo per la tessera "settimana corrente + confronto + sparkline" della tab "KPI
 * (nuovo)" — vive separato da kpi.ts perché non tocca l'aggregazione MetaDaily/Funnel esistente,
 * lavora solo sulla serie settimanale già calcolata altrove (trendSettimanale di kpi.ts, o una
 * serie equivalente costruita da GHL/altro).
 */

export type PuntoSettimanale = { settimana: string; valore: number | null };

export type TesseraSettimanale = {
  ultimaSettimana: { settimana: string; valore: number | null; inCorso: boolean };
  confronto: {
    settimanaCorrente: string;
    settimanaPrecedente: string;
    valoreCorrente: number;
    valorePrecedente: number;
    deltaPercentuale: number | null;
  } | null;
  sparkline: PuntoSettimanale[];
};

const NUMERO_SETTIMANE_SPARKLINE_DEFAULT = 8;

/** Domenica (YYYY-MM-DD) della settimana il cui lunedì è `lunedi` (YYYY-MM-DD) — stesso stile aritmetico UTC di kpi.ts/ghl.ts. */
function domenicaDiSettimana(lunedi: string): string {
  const d = new Date(`${lunedi}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Oggi reale in formato YYYY-MM-DD — mai chiamata nei test, che iniettano sempre opzioni.oggi. */
function oggiDefault(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tessera "settimana corrente" per una serie settimanale (es. costo per lead, investimento, ...):
 * ultima settimana (in corso o conclusa), confronto fra le ultime due settimane CONCLUSE, e una
 * sparkline delle ultime N settimane concluse. Una settimana è "in corso" se la sua domenica non è
 * ancora passata rispetto a `opzioni.oggi` — la settimana in corso non entra mai nel confronto né
 * nella sparkline perché il suo valore è per forza parziale (dati fino a oggi, non fino a domenica).
 */
export function calcolaTesseraSettimanale(
  serie: PuntoSettimanale[],
  opzioni?: { oggi?: string; numeroSettimaneSparkline?: number }
): TesseraSettimanale | null {
  if (serie.length === 0) return null;

  const oggi = opzioni?.oggi ?? oggiDefault();
  const numeroSettimaneSparkline = opzioni?.numeroSettimaneSparkline ?? NUMERO_SETTIMANE_SPARKLINE_DEFAULT;

  const inCorso = (p: PuntoSettimanale) => domenicaDiSettimana(p.settimana) >= oggi;

  const ultimoPunto = serie[serie.length - 1];
  const ultimaSettimana = {
    settimana: ultimoPunto.settimana,
    valore: ultimoPunto.valore,
    inCorso: inCorso(ultimoPunto),
  };

  // Solo settimane concluse, con valore non-null: base comune per confronto e sparkline.
  const concluseConValore = serie.filter((p) => !inCorso(p) && p.valore !== null) as { settimana: string; valore: number }[];

  let confronto: TesseraSettimanale["confronto"] = null;
  if (concluseConValore.length >= 2) {
    const correnteP = concluseConValore[concluseConValore.length - 1];
    const precedenteP = concluseConValore[concluseConValore.length - 2];
    confronto = {
      settimanaCorrente: correnteP.settimana,
      settimanaPrecedente: precedenteP.settimana,
      valoreCorrente: correnteP.valore,
      valorePrecedente: precedenteP.valore,
      deltaPercentuale: divideOrNull(correnteP.valore - precedenteP.valore, precedenteP.valore),
    };
  }

  const concluse = serie.filter((p) => !inCorso(p));
  const sparkline = concluse.slice(Math.max(0, concluse.length - numeroSettimaneSparkline));

  return { ultimaSettimana, confronto, sparkline };
}

/** Serie del costo per lead settimanale a partire da un trend investimento/lead (es. trendSettimanale di kpi.ts). */
export function serieCostoPerLead(
  trend: { settimana: string; investimento: number; numeroLead: number }[]
): PuntoSettimanale[] {
  return trend.map((r) => ({ settimana: r.settimana, valore: divideOrNull(r.investimento, r.numeroLead) }));
}
