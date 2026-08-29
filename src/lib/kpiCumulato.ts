import type { Campagna, FunnelRow, KpiGroup, MetaDailyRow } from "@/types/kpi";
import { divideOrNull } from "@/lib/kpi";

const TIPO_CAMPAGNA_CUMULATO = "Da sempre";

/**
 * Prima data (YYYY-MM-DD) con almeno un dato per questa sede, tra MetaDaily (data della riga) e
 * Funnel (primo giorno del mese della riga, dato che il Funnel è tracciato solo a livello mensile).
 * Stessa attribuzione sede di computeKpi in kpi.ts: una riga MetaDaily appartiene alla sede tramite
 * la sua campagna (clienteId+sedeId), una riga FunnelRow ha già sedeId proprio.
 */
export function primaDataConDati(
  clienteId: string,
  sedeId: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  funnel: FunnelRow[]
): string | null {
  const campaignIdsSede = new Set(
    campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId).map((c) => c.campaignId)
  );

  let prima: string | null = null;
  const aggiorna = (data: string) => {
    if (prima === null || data < prima) prima = data;
  };

  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignIdsSede.has(row.campaignId)) continue;
    aggiorna(row.data);
  }

  for (const row of funnel) {
    if (row.clienteId !== clienteId) continue;
    if (row.sedeId !== sedeId) continue;
    aggiorna(`${row.mese}-01`);
  }

  return prima;
}

/**
 * Totale cumulato "da sempre" per una sede: somma TUTTE le righe della sede (nessun filtro di
 * data/periodo), stesse formule derivate di KpiGroup usate da computeKpi in kpi.ts per il totale
 * normale. Reduce lineare diretto (non passa da computeKpi, che costruirebbe una griglia
 * settimanale inutile su un range di anni).
 */
export function computeTotaleCumulato(
  clienteId: string,
  sedeId: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  funnel: FunnelRow[]
): KpiGroup {
  const campaignIdsSede = new Set(
    campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId).map((c) => c.campaignId)
  );

  let investimento = 0;
  let impressions = 0;
  let numeroLead = 0;
  let clicUniciUscita = 0;
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignIdsSede.has(row.campaignId)) continue;
    investimento += row.spesa;
    impressions += row.impressions;
    numeroLead += row.lead;
    clicUniciUscita += row.clicUniciUscita;
  }
  const cpmRatio = divideOrNull(investimento, impressions);

  let numeroRichieste = 0;
  let appuntamentiFissati = 0;
  let appuntamentiEffettuati = 0;
  let numeroVendite = 0;
  let fatturato = 0;
  for (const row of funnel) {
    if (row.clienteId !== clienteId) continue;
    if (row.sedeId !== sedeId) continue;
    numeroRichieste += row.richieste;
    appuntamentiFissati += row.appuntamentiFissati;
    appuntamentiEffettuati += row.appuntamentiEffettuati;
    numeroVendite += row.vendite;
    fatturato += row.fatturato;
  }

  return {
    tipoCampagna: TIPO_CAMPAGNA_CUMULATO,
    investimento,
    impressions,
    cpm: cpmRatio === null ? null : cpmRatio * 1000,
    numeroLead,
    costoPerLead: divideOrNull(investimento, numeroLead),
    clicUniciUscita,
    costoPerClicUnico: divideOrNull(investimento, clicUniciUscita),
    ctrClicUnici: divideOrNull(clicUniciUscita, impressions),
    numeroRichieste,
    costoPerRichiesta: divideOrNull(investimento, numeroRichieste),
    appuntamentiFissati,
    appuntamentiEffettuati,
    percentualeEffettuatiSuFissati: divideOrNull(appuntamentiEffettuati, appuntamentiFissati),
    costoPerAppuntamentoFissato: divideOrNull(investimento, appuntamentiFissati),
    costoPerAppuntamentoEffettuato: divideOrNull(investimento, appuntamentiEffettuati),
    numeroVendite,
    tassoDiChiusura: divideOrNull(numeroVendite, appuntamentiEffettuati),
    fatturato,
    roas: divideOrNull(fatturato, investimento),
    cpa: divideOrNull(investimento, numeroVendite),
  };
}
