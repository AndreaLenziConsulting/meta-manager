import type { Campagna, FunnelRow, KpiGroup, MetaDailyRow, RigaCampagna } from "@/types/kpi";

const NON_CLASSIFICATA = "Non classificata";

function meseDiData(data: string): string {
  return data.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
}

// export: riusata da ghl.ts per raggruppare il fatturato GHL nella stessa identica settimana
// (lunedì-domenica) usata qui per trendSettimanale — due implementazioni indipendenti rischierebbero
// di derivare chiavi-settimana leggermente diverse, che romperebbe silenziosamente il join fra
// trendSettimanale e fatturatoPerSettimana in kpiGhlOverlay.ts.
/** Lunedì della settimana che contiene `data` (YYYY-MM-DD) — chiave stabile e ordinabile, niente calcolo ISO-week. */
export function settimanaDiData(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  const giorno = (d.getUTCDay() + 6) % 7; // 0 = lunedì ... 6 = domenica
  d.setUTCDate(d.getUTCDate() - giorno);
  return d.toISOString().slice(0, 10);
}

/** Ultimo giorno di calendario (YYYY-MM-DD) del mese `mese` (YYYY-MM) — stesso trucco già in uso in api/ghl/route.ts. */
function ultimoGiornoDelMese(mese: string): string {
  const [anno, m] = mese.split("-").map(Number);
  return new Date(Date.UTC(anno, m, 1) - 1).toISOString().slice(0, 10);
}

/** Lunedì della settimana successiva a `settimana` (YYYY-MM-DD, un lunedì) — solo per scandire la griglia di settimane sotto. */
function settimanaSuccessiva(settimana: string): string {
  const d = new Date(`${settimana}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

// export: riusata da kpiGhlOverlay.ts per ricalcolare ROAS/CPA con la stessa regola di null-handling
// quando fatturato/vendite vengono sostituiti da GHL — non reimplementata lì.
export function divideOrNull(numeratore: number, denominatore: number): number | null {
  if (!denominatore) return null;
  return numeratore / denominatore;
}

function nuovoGruppoVuoto(tipoCampagna: string): KpiGroup {
  return {
    tipoCampagna,
    investimento: 0,
    impressions: 0,
    cpm: null,
    numeroLead: 0,
    costoPerLead: null,
    clicUniciUscita: 0,
    costoPerClicUnico: null,
    ctrClicUnici: null,
    numeroRichieste: 0,
    costoPerRichiesta: null,
    appuntamentiFissati: 0,
    appuntamentiEffettuati: 0,
    percentualeEffettuatiSuFissati: null,
    costoPerAppuntamentoFissato: null,
    costoPerAppuntamentoEffettuato: null,
    numeroVendite: 0,
    tassoDiChiusura: null,
    fatturato: 0,
    roas: null,
    cpa: null,
  };
}

function chiudiFormule(g: KpiGroup): KpiGroup {
  // CPM ricalcolato dall'aggregato (investimento/impressions*1000), MAI media dei cpm giornalieri
  // di MetaDailyRow — quella media pesa ogni giorno allo stesso modo indipendentemente da quante
  // impression ha portato, questo no.
  const cpmRatio = divideOrNull(g.investimento, g.impressions);
  return {
    ...g,
    cpm: cpmRatio === null ? null : cpmRatio * 1000,
    costoPerLead: divideOrNull(g.investimento, g.numeroLead),
    costoPerClicUnico: divideOrNull(g.investimento, g.clicUniciUscita),
    ctrClicUnici: divideOrNull(g.clicUniciUscita, g.impressions),
    costoPerRichiesta: divideOrNull(g.investimento, g.numeroRichieste),
    percentualeEffettuatiSuFissati: divideOrNull(g.appuntamentiEffettuati, g.appuntamentiFissati),
    costoPerAppuntamentoFissato: divideOrNull(g.investimento, g.appuntamentiFissati),
    costoPerAppuntamentoEffettuato: divideOrNull(g.investimento, g.appuntamentiEffettuati),
    tassoDiChiusura: divideOrNull(g.numeroVendite, g.appuntamentiEffettuati),
    roas: divideOrNull(g.fatturato, g.investimento),
    cpa: divideOrNull(g.investimento, g.numeroVendite),
  };
}

export type KpiComputationResult = {
  gruppi: KpiGroup[];
  totale: KpiGroup;
  trend: { mese: string; investimento: number; fatturato: number; numeroLead: number }[];
  // fatturato qui è SEMPRE quello del mese a cui la settimana appartiene (il Funnel è tracciato
  // solo a livello mensile, non esiste un vero "fatturato della settimana") — null solo se quel
  // mese non ha proprio un'entrata in trendMap (caso limite, non dovrebbe verificarsi dato che la
  // settimana deriva da una riga MetaDaily che ha già popolato trendMap per lo stesso mese).
  // `mese` = mese di appartenenza già risolto qui sotto — esposto perché il chiamante può avere un
  // fatturato mensile alternativo da sovrapporre a questa settimana (vedi kpiGhlOverlay.ts).
  // appuntamentiFissati/appuntamentiEffettuati/numeroVendite seguono ESATTAMENTE lo stesso
  // trattamento di fatturato sopra (Funnel mensile ripetuto su ogni settimana del mese proprietario)
  // — servono al blocco 6 del redesign KPI (grafici "Andamento appuntamenti" e "Saldo netto
  // cumulato"), null nello stesso identico caso limite di fatturato.
  trendSettimanale: {
    settimana: string;
    investimento: number;
    fatturato: number | null;
    numeroLead: number;
    appuntamentiFissati: number | null;
    appuntamentiEffettuati: number | null;
    numeroVendite: number | null;
    mese: string;
  }[];
};

/**
 * Aggrega MetaDaily (spesa/lead, via mapping campagna -> tipo_campagna) e Funnel (richieste/appuntamenti/vendite/fatturato)
 * per una singola sede di un cliente, nella finestra [daMese, aMese] inclusiva, raggruppando per tipo_campagna.
 *
 * Se `campagneSelezionate` è passato, filtra le righe MetaDaily a quelle campagne; un tipo_campagna lato Funnel
 * resta incluso per intero finché almeno una delle sue campagne è nel set (il Funnel non è tracciato per
 * singola campagna, quindi non è divisibile ulteriormente).
 */
export function computeKpi(
  clienteId: string,
  sedeId: string,
  daMese: string,
  aMese: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  funnel: FunnelRow[],
  campagneSelezionate?: Set<string>
): KpiComputationResult {
  const campagneCliente = campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId);
  const tipoPerCampagna = new Map(campagneCliente.map((c) => [c.campaignId, c.tipoCampagna || NON_CLASSIFICATA]));
  // Una campagna che non appartiene a questa sede (o non ancora mappata) va sempre esclusa qui —
  // a differenza di prima (un cliente = una sola sede implicita), non basta più "sconosciuta ->
  // Non classificata ma inclusa": finirebbe nei numeri della sede sbagliata.
  const campaignIdsSede = new Set(campagneCliente.map((c) => c.campaignId));
  const tipiConCampagnaSelezionata = campagneSelezionate
    ? new Set(
        campagneCliente
          .filter((c) => campagneSelezionate.has(c.campaignId))
          .map((c) => c.tipoCampagna || NON_CLASSIFICATA)
      )
    : null;

  const gruppiMap = new Map<string, KpiGroup>();
  const trendMap = new Map<
    string,
    { investimento: number; fatturato: number; numeroLead: number; appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number }
  >();
  // speesaPerMese: dentro ogni settimana, quanto investimento viene da ciascun mese — una settimana può
  // ricadere a cavallo di due mesi (bastano poche righe MetaDaily negli ultimi/primi giorni del mese), quindi
  // il solo lunedì della settimana non basta per decidere di quale mese mostrare il fatturato (tracciato solo
  // a livello mensile): si usa il mese con più spesa in quella settimana.
  const trendSettimanaleMap = new Map<string, { investimento: number; numeroLead: number; spesaPerMese: Map<string, number> }>();

  // Una entry per OGNI settimana del periodo, non solo quelle con almeno una riga MetaDaily reale
  // — altrimenti un mese con poca spesa sincronizzata avrebbe pochi o un solo punto nel grafico
  // (bug segnalato: "agosto ne ha solo 1??"), e i confini mese del grafico non avrebbero settimane
  // vicine su cui allinearsi. Investimento/numeroLead partono da 0, sovrascritti sotto se esistono
  // righe MetaDaily reali per quella settimana.
  const primaSettimana = settimanaDiData(`${daMese}-01`);
  const ultimaSettimana = settimanaDiData(ultimoGiornoDelMese(aMese));
  for (let s = primaSettimana; s <= ultimaSettimana; s = settimanaSuccessiva(s)) {
    trendSettimanaleMap.set(s, { investimento: 0, numeroLead: 0, spesaPerMese: new Map() });
  }

  const nelPeriodo = (mese: string) => mese >= daMese && mese <= aMese;

  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignIdsSede.has(row.campaignId)) continue;
    if (campagneSelezionate && !campagneSelezionate.has(row.campaignId)) continue;
    const mese = meseDiData(row.data);
    if (!nelPeriodo(mese)) continue;

    const tipoCampagna = tipoPerCampagna.get(row.campaignId) ?? NON_CLASSIFICATA;
    const gruppo = gruppiMap.get(tipoCampagna) ?? nuovoGruppoVuoto(tipoCampagna);
    gruppo.investimento += row.spesa;
    gruppo.impressions += row.impressions;
    gruppo.numeroLead += row.lead;
    gruppo.clicUniciUscita += row.clicUniciUscita;
    gruppiMap.set(tipoCampagna, gruppo);

    const trendEntry =
      trendMap.get(mese) ?? { investimento: 0, fatturato: 0, numeroLead: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 };
    trendEntry.investimento += row.spesa;
    trendEntry.numeroLead += row.lead;
    trendMap.set(mese, trendEntry);

    const settimana = settimanaDiData(row.data);
    const settimanaEntry = trendSettimanaleMap.get(settimana) ?? { investimento: 0, numeroLead: 0, spesaPerMese: new Map<string, number>() };
    settimanaEntry.investimento += row.spesa;
    settimanaEntry.numeroLead += row.lead;
    settimanaEntry.spesaPerMese.set(mese, (settimanaEntry.spesaPerMese.get(mese) ?? 0) + row.spesa);
    trendSettimanaleMap.set(settimana, settimanaEntry);
  }

  for (const row of funnel) {
    if (row.clienteId !== clienteId) continue;
    if (row.sedeId !== sedeId) continue;
    if (!nelPeriodo(row.mese)) continue;

    const tipoCampagna = row.tipoCampagna || NON_CLASSIFICATA;
    if (tipiConCampagnaSelezionata && !tipiConCampagnaSelezionata.has(tipoCampagna)) continue;

    const gruppo = gruppiMap.get(tipoCampagna) ?? nuovoGruppoVuoto(tipoCampagna);
    gruppo.numeroRichieste += row.richieste;
    gruppo.appuntamentiFissati += row.appuntamentiFissati;
    gruppo.appuntamentiEffettuati += row.appuntamentiEffettuati;
    gruppo.numeroVendite += row.vendite;
    gruppo.fatturato += row.fatturato;
    gruppiMap.set(tipoCampagna, gruppo);

    const trendEntry =
      trendMap.get(row.mese) ?? { investimento: 0, fatturato: 0, numeroLead: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 };
    trendEntry.fatturato += row.fatturato;
    trendEntry.appuntamentiFissati += row.appuntamentiFissati;
    trendEntry.appuntamentiEffettuati += row.appuntamentiEffettuati;
    trendEntry.numeroVendite += row.vendite;
    trendMap.set(row.mese, trendEntry);
  }

  const gruppi = Array.from(gruppiMap.values())
    .map(chiudiFormule)
    .sort((a, b) => b.investimento - a.investimento);

  const totaleGrezzo = gruppi.reduce((acc, g) => {
    acc.investimento += g.investimento;
    acc.impressions += g.impressions;
    acc.numeroLead += g.numeroLead;
    acc.clicUniciUscita += g.clicUniciUscita;
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

  const trendSettimanale = Array.from(trendSettimanaleMap.entries())
    .map(([settimana, v]) => {
      // Default: il mese del lunedì stesso — usato quando la settimana non ha nessuna riga
      // MetaDaily reale (placeholder aggiunto sopra per completare la griglia). spesaMax parte da 0
      // (non -1): una spesa reale di 0€ in un mese non deve scavalcare questo default a torto.
      let meseProprietario = settimana.slice(0, 7);
      let spesaMax = 0;
      for (const [mese, spesa] of v.spesaPerMese) {
        if (spesa > spesaMax) {
          spesaMax = spesa;
          meseProprietario = mese;
        }
      }
      return {
        settimana,
        investimento: v.investimento,
        numeroLead: v.numeroLead,
        // il Funnel è tracciato solo a livello mensile: il fatturato mostrato per una settimana è
        // quello del mese con più spesa in quella settimana (vedi nota sopra su spesaPerMese).
        fatturato: trendMap.get(meseProprietario)?.fatturato ?? null,
        // Stesso trattamento di fatturato sopra — mensile Funnel ripetuto sul mese proprietario
        // della settimana (vedi tipo KpiComputationResult per il perché).
        appuntamentiFissati: trendMap.get(meseProprietario)?.appuntamentiFissati ?? null,
        appuntamentiEffettuati: trendMap.get(meseProprietario)?.appuntamentiEffettuati ?? null,
        numeroVendite: trendMap.get(meseProprietario)?.numeroVendite ?? null,
        // Esposto (non solo usato internamente per il lookup sopra) perché il chiamante può avere
        // un fatturato mensile alternativo da sovrapporre a questa settimana (vedi
        // kpiGhlOverlay.ts) — senza saperne il mese di appartenenza non saprebbe quale usare.
        mese: meseProprietario,
      };
    })
    .sort((a, b) => a.settimana.localeCompare(b.settimana));

  return { gruppi, totale, trend, trendSettimanale };
}

/**
 * Spesa/lead per singola campagna (non aggregati per tipo) — solo le metriche derivate da Meta Ads,
 * dato che il Funnel (vendite, fatturato, ecc.) è tracciato solo per tipo_campagna, non per campagna.
 */
export function computeKpiPerCampagna(
  clienteId: string,
  sedeId: string,
  daMese: string,
  aMese: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  campagneSelezionate?: Set<string>,
  ultimoCambioPerCampagna?: Map<string, string>
): RigaCampagna[] {
  const campagneSede = campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId);
  const infoCampagna = new Map(campagneSede.map((c) => [c.campaignId, c]));
  const campaignIdsSede = new Set(campagneSede.map((c) => c.campaignId));

  const nelPeriodo = (mese: string) => mese >= daMese && mese <= aMese;
  const righeMap = new Map<string, { investimento: number; impressions: number; numeroLead: number; clicUniciUscita: number }>();

  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignIdsSede.has(row.campaignId)) continue;
    if (campagneSelezionate && !campagneSelezionate.has(row.campaignId)) continue;
    if (!nelPeriodo(meseDiData(row.data))) continue;

    const entry = righeMap.get(row.campaignId) ?? { investimento: 0, impressions: 0, numeroLead: 0, clicUniciUscita: 0 };
    entry.investimento += row.spesa;
    entry.impressions += row.impressions;
    entry.numeroLead += row.lead;
    entry.clicUniciUscita += row.clicUniciUscita;
    righeMap.set(row.campaignId, entry);
  }

  return Array.from(righeMap.entries())
    .map(([campaignId, v]) => {
      const info = infoCampagna.get(campaignId);
      const cpmRatio = divideOrNull(v.investimento, v.impressions);
      return {
        campaignId,
        nomeCampagna: info?.nomeCampagna ?? campaignId,
        tipoCampagna: info?.tipoCampagna || NON_CLASSIFICATA,
        stato: info?.stato ?? "",
        statoDal: ultimoCambioPerCampagna?.get(campaignId) ?? null,
        investimento: v.investimento,
        impressions: v.impressions,
        cpm: cpmRatio === null ? null : cpmRatio * 1000,
        numeroLead: v.numeroLead,
        costoPerLead: divideOrNull(v.investimento, v.numeroLead),
        clicUniciUscita: v.clicUniciUscita,
        costoPerClicUnico: divideOrNull(v.investimento, v.clicUniciUscita),
        ctrClicUnici: divideOrNull(v.clicUniciUscita, v.impressions),
      };
    })
    // Attive prima delle non attive (sempre, a prescindere dall'investimento) — poi investimento
    // decrescente dentro ciascuno dei due gruppi. Le campagne in pausa/archiviate/eliminate non
    // sono azionabili ora, non devono competere per posizione con quelle che lo sono.
    .sort((a, b) => {
      const aAttiva = a.stato === "ACTIVE" ? 0 : 1;
      const bAttiva = b.stato === "ACTIVE" ? 0 : 1;
      if (aAttiva !== bAttiva) return aAttiva - bAttiva;
      return b.investimento - a.investimento;
    });
}

/**
 * Spesa e lead di una sede su una finestra di date reali (non mesi interi) — usata per la vista
 * "salute clienti" a 7 giorni. Le vendite del Funnel sono tracciate solo a livello mensile, quindi
 * su una finestra sub-mensile non sono attendibili: qui il segnale è sempre il costo per lead.
 * MetaDaily non porta sedeId: si passa da campagne (campaignId -> sede) come nelle altre funzioni.
 */
export function computeSpesaLeadPeriodo(
  clienteId: string,
  sedeId: string,
  daData: string, // YYYY-MM-DD
  aData: string, // YYYY-MM-DD
  metaDaily: MetaDailyRow[],
  campagne: Campagna[]
): { investimento: number; numeroLead: number; costoPerLead: number | null } {
  const campaignIdsSede = new Set(
    campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId).map((c) => c.campaignId)
  );
  let investimento = 0;
  let numeroLead = 0;
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignIdsSede.has(row.campaignId)) continue;
    if (row.data < daData || row.data > aData) continue;
    investimento += row.spesa;
    numeroLead += row.lead;
  }
  return { investimento, numeroLead, costoPerLead: divideOrNull(investimento, numeroLead) };
}
