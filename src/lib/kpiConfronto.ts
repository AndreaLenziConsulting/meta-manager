import { divideOrNull } from "@/lib/kpi";
import type { PuntoSettimanale } from "@/lib/kpiSettimanale";
import type { FunnelRow } from "@/types/kpi";

/**
 * Blocco di calcolo per la tab "confronto sedi" della tab "KPI (nuovo)" — una riga per sede più una
 * riga "Media", con evidenza di quali sedi vincono su ciascuna metrica competitiva. Vive separato da
 * kpi.ts perché lavora su righe già aggregate per sede (una computeKpi/totale per sede), non
 * sull'aggregazione MetaDaily/Funnel grezza.
 */
export type RigaConfrontoSede = {
  sedeId: string;
  nome: string;
  investimento: number;
  numeroLead: number;
  costoPerLead: number | null;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  percentualeEffettuatiSuFissati: number | null;
  numeroVendite: number;
  tassoDiChiusura: number | null;
  fatturato: number;
  roas: number | null;
  cpa: number | null;
};

/**
 * Riga "Media" della tabella di confronto sedi: i volumi (investimento, lead, appuntamenti, vendite,
 * fatturato) sono la media aritmetica semplice fra le sedi; i rapporti (costoPerLead,
 * percentualeEffettuatiSuFissati, tassoDiChiusura, roas, cpa) sono ricalcolati totale-su-totale sulle
 * somme grezze — MAI come media dei rapporti già calcolati per singola sede. La media di
 * percentuali/costi-medi pesa ogni sede allo stesso modo indipendentemente dal suo volume, il che è
 * statisticamente sbagliato (una sede con 2 lead a 100€ e una con 200 lead a 10€ non hanno "in media"
 * un CPL di 55€: il CPL vero del gruppo è investimento totale / lead totali).
 */
export function calcolaRigaMedia(righe: RigaConfrontoSede[]): RigaConfrontoSede & { sedeId: "media"; nome: "Media" } {
  const n = righe.length;

  const somma = righe.reduce(
    (acc, r) => {
      acc.investimento += r.investimento;
      acc.numeroLead += r.numeroLead;
      acc.appuntamentiFissati += r.appuntamentiFissati;
      acc.appuntamentiEffettuati += r.appuntamentiEffettuati;
      acc.numeroVendite += r.numeroVendite;
      acc.fatturato += r.fatturato;
      return acc;
    },
    { investimento: 0, numeroLead: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0, fatturato: 0 }
  );

  // n=0 (nessuna sede) è un caso limite non atteso a monte, ma evita NaN da 0/0: media = 0 come i volumi.
  const media = (totale: number) => (n === 0 ? 0 : totale / n);

  return {
    sedeId: "media",
    nome: "Media",
    investimento: media(somma.investimento),
    numeroLead: media(somma.numeroLead),
    costoPerLead: divideOrNull(somma.investimento, somma.numeroLead),
    appuntamentiFissati: media(somma.appuntamentiFissati),
    appuntamentiEffettuati: media(somma.appuntamentiEffettuati),
    percentualeEffettuatiSuFissati: divideOrNull(somma.appuntamentiEffettuati, somma.appuntamentiFissati),
    numeroVendite: media(somma.numeroVendite),
    tassoDiChiusura: divideOrNull(somma.numeroVendite, somma.appuntamentiEffettuati),
    fatturato: media(somma.fatturato),
    roas: divideOrNull(somma.fatturato, somma.investimento),
    cpa: divideOrNull(somma.investimento, somma.numeroVendite),
  };
}

/** Metriche su cui la tabella di confronto evidenzia la/le sede/i migliore/i, con la direzione "buono" di ciascuna. */
export const METRICHE_COMPETITIVE: {
  chiave: "costoPerLead" | "percentualeEffettuatiSuFissati" | "tassoDiChiusura" | "roas" | "cpa";
  direzione: "min" | "max";
}[] = [
  { chiave: "costoPerLead", direzione: "min" },
  { chiave: "percentualeEffettuatiSuFissati", direzione: "max" },
  { chiave: "tassoDiChiusura", direzione: "max" },
  { chiave: "roas", direzione: "max" },
  { chiave: "cpa", direzione: "min" },
];

/**
 * SedeId della/e sede/i migliore/i su una metrica: tutte quelle che raggiungono il valore ottimale
 * (min o max, a seconda di `direzione`) fra i valori non-null — gestisce pareggi ritornando più di un
 * sedeId. Righe con valore null (dato non disponibile, es. 0 lead) sono escluse dal confronto, non
 * trattate come "le peggiori". Se tutte le righe sono null, ritorna [].
 */
export function trovaSediMigliori(righe: { sedeId: string; valore: number | null }[], direzione: "min" | "max"): string[] {
  const conValore = righe.filter((r): r is { sedeId: string; valore: number } => r.valore !== null);
  if (conValore.length === 0) return [];

  const migliore =
    direzione === "min"
      ? Math.min(...conValore.map((r) => r.valore))
      : Math.max(...conValore.map((r) => r.valore));

  return conValore.filter((r) => r.valore === migliore).map((r) => r.sedeId);
}

/**
 * Appuntamenti fissati/effettuati e vendite per mese di una sede — stessa attribuzione diretta
 * clienteId+sedeId usata da computeKpi in kpi.ts. Un cliente+sede+mese può avere più righe Funnel (una
 * per tipoCampagna): tutte vengono sommate nell'entry di quel mese.
 */
export function funnelPerMese(
  clienteId: string,
  sedeId: string,
  funnel: FunnelRow[]
): Map<string, { appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number }> {
  const mappa = new Map<string, { appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number }>();
  for (const row of funnel) {
    if (row.clienteId !== clienteId) continue;
    if (row.sedeId !== sedeId) continue;

    const entry = mappa.get(row.mese) ?? { appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 };
    entry.appuntamentiFissati += row.appuntamentiFissati;
    entry.appuntamentiEffettuati += row.appuntamentiEffettuati;
    entry.numeroVendite += row.vendite;
    mappa.set(row.mese, entry);
  }
  return mappa;
}

/**
 * Serie settimanale del "costo per X" (X = appuntamenti fissati/effettuati o vendite), calcolata a
 * livello mensile (investimento del mese / conteggio Funnel del mese) e ripetuta identica su ogni
 * settimana di quel mese — stessa convenzione già usata da TrendChart.tsx per il fatturato Funnel: il
 * Funnel è tracciato solo a livello mensile, non esiste un vero dato settimanale, quindi ogni settimana
 * del mese mostra lo stesso valore mensile (comportamento voluto, non un bug). Se il mese della
 * settimana non ha un'entry in trendMensile o in funnelPerMeseMap, il valore è null (dato non
 * disponibile), mai 0.
 */
export function serieCostoMensileRipetutaPerSettimana(
  trendSettimanale: { settimana: string; mese: string }[],
  trendMensile: { mese: string; investimento: number }[],
  funnelPerMeseMap: ReturnType<typeof funnelPerMese>,
  campo: "appuntamentiFissati" | "appuntamentiEffettuati" | "numeroVendite"
): PuntoSettimanale[] {
  const investimentoPerMese = new Map(trendMensile.map((t) => [t.mese, t.investimento]));

  return trendSettimanale.map((s) => {
    const investimentoMese = investimentoPerMese.get(s.mese);
    const funnelMese = funnelPerMeseMap.get(s.mese);
    if (investimentoMese === undefined || funnelMese === undefined) {
      return { settimana: s.settimana, valore: null };
    }
    return { settimana: s.settimana, valore: divideOrNull(investimentoMese, funnelMese[campo]) };
  });
}
