import type { Campagna, FunnelRow, KpiGroup, MetaDailyRow } from "@/types/kpi";

const NON_CLASSIFICATA = "Non classificata";

function meseDiData(data: string): string {
  return data.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
}

function divideOrNull(numeratore: number, denominatore: number): number | null {
  if (!denominatore) return null;
  return numeratore / denominatore;
}

function nuovoGruppoVuoto(tipoCampagna: string): KpiGroup {
  return {
    tipoCampagna,
    investimento: 0,
    numeroLead: 0,
    costoPerLead: null,
    numeroRichieste: 0,
    costoPerRichiesta: null,
    appuntamentiFissati: 0,
    appuntamentiEffettuati: 0,
    percentualeEffettuatiSuFissati: null,
    costoPerAppuntamentoEffettuato: null,
    numeroVendite: 0,
    tassoDiChiusura: null,
    fatturato: 0,
    roas: null,
    cpa: null,
  };
}

function chiudiFormule(g: KpiGroup): KpiGroup {
  return {
    ...g,
    costoPerLead: divideOrNull(g.investimento, g.numeroLead),
    costoPerRichiesta: divideOrNull(g.investimento, g.numeroRichieste),
    percentualeEffettuatiSuFissati: divideOrNull(g.appuntamentiEffettuati, g.appuntamentiFissati),
    costoPerAppuntamentoEffettuato: divideOrNull(g.investimento, g.appuntamentiEffettuati),
    tassoDiChiusura: divideOrNull(g.numeroVendite, g.appuntamentiEffettuati),
    roas: divideOrNull(g.fatturato, g.investimento),
    cpa: divideOrNull(g.investimento, g.numeroVendite),
  };
}

export type KpiComputationResult = {
  gruppi: KpiGroup[];
  totale: KpiGroup;
  trend: { mese: string; investimento: number; fatturato: number }[];
};

/**
 * Aggrega MetaDaily (spesa/lead, via mapping campagna -> tipo_campagna) e Funnel (richieste/appuntamenti/vendite/fatturato)
 * per cliente, nella finestra [daMese, aMese] inclusiva, raggruppando per tipo_campagna.
 */
export function computeKpi(
  clienteId: string,
  daMese: string,
  aMese: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  funnel: FunnelRow[]
): KpiComputationResult {
  const tipoPerCampagna = new Map(
    campagne.filter((c) => c.clienteId === clienteId).map((c) => [c.campaignId, c.tipoCampagna || NON_CLASSIFICATA])
  );

  const gruppiMap = new Map<string, KpiGroup>();
  const trendMap = new Map<string, { investimento: number; fatturato: number }>();

  const nelPeriodo = (mese: string) => mese >= daMese && mese <= aMese;

  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    const mese = meseDiData(row.data);
    if (!nelPeriodo(mese)) continue;

    const tipoCampagna = tipoPerCampagna.get(row.campaignId) ?? NON_CLASSIFICATA;
    const gruppo = gruppiMap.get(tipoCampagna) ?? nuovoGruppoVuoto(tipoCampagna);
    gruppo.investimento += row.spesa;
    gruppo.numeroLead += row.lead;
    gruppiMap.set(tipoCampagna, gruppo);

    const trendEntry = trendMap.get(mese) ?? { investimento: 0, fatturato: 0 };
    trendEntry.investimento += row.spesa;
    trendMap.set(mese, trendEntry);
  }

  for (const row of funnel) {
    if (row.clienteId !== clienteId) continue;
    if (!nelPeriodo(row.mese)) continue;

    const tipoCampagna = row.tipoCampagna || NON_CLASSIFICATA;
    const gruppo = gruppiMap.get(tipoCampagna) ?? nuovoGruppoVuoto(tipoCampagna);
    gruppo.numeroRichieste += row.richieste;
    gruppo.appuntamentiFissati += row.appuntamentiFissati;
    gruppo.appuntamentiEffettuati += row.appuntamentiEffettuati;
    gruppo.numeroVendite += row.vendite;
    gruppo.fatturato += row.fatturato;
    gruppiMap.set(tipoCampagna, gruppo);

    const trendEntry = trendMap.get(row.mese) ?? { investimento: 0, fatturato: 0 };
    trendEntry.fatturato += row.fatturato;
    trendMap.set(row.mese, trendEntry);
  }

  const gruppi = Array.from(gruppiMap.values())
    .map(chiudiFormule)
    .sort((a, b) => b.investimento - a.investimento);

  const totaleGrezzo = gruppi.reduce((acc, g) => {
    acc.investimento += g.investimento;
    acc.numeroLead += g.numeroLead;
    acc.numeroRichieste += g.numeroRichieste;
    acc.appuntamentiFissati += g.appuntamentiFissati;
    acc.appuntamentiEffettuati += g.appuntamentiEffettuati;
    acc.numeroVendite += g.numeroVendite;
    acc.fatturato += g.fatturato;
    return acc;
  }, nuovoGruppoVuoto("Totale"));
  const totale = chiudiFormule(totaleGrezzo);

  const trend = Array.from(trendMap.entries())
    .map(([mese, v]) => ({ mese, ...v }))
    .sort((a, b) => a.mese.localeCompare(b.mese));

  return { gruppi, totale, trend };
}

/**
 * Spesa e lead di un cliente su una finestra di date reali (non mesi interi) — usata per la vista
 * "salute clienti" a 7 giorni. Le vendite del Funnel sono tracciate solo a livello mensile, quindi
 * su una finestra sub-mensile non sono attendibili: qui il segnale è sempre il costo per lead.
 */
export function computeSpesaLeadPeriodo(
  clienteId: string,
  daData: string, // YYYY-MM-DD
  aData: string, // YYYY-MM-DD
  metaDaily: MetaDailyRow[]
): { investimento: number; numeroLead: number; costoPerLead: number | null } {
  let investimento = 0;
  let numeroLead = 0;
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (row.data < daData || row.data > aData) continue;
    investimento += row.spesa;
    numeroLead += row.lead;
  }
  return { investimento, numeroLead, costoPerLead: divideOrNull(investimento, numeroLead) };
}
