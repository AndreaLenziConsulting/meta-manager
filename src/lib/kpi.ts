import { aggiungiGiorni } from "@/lib/roadmap";
import type { Campagna, Canale, RisultatoCommercialeRow, KpiGroup, MetaDailyRow, RigaCampagna } from "@/types/kpi";

const NON_CLASSIFICATA = "Non classificata";

/** Canale assente su una riga scritta prima dell'introduzione del campo (o su una fixture di test
 * che non lo conosce) = "meta", sempre — vedi il commento su Canale in types/kpi.ts. */
export function canaleEffettivo(riga: { canale?: Canale }): Canale {
  return riga.canale ?? "meta";
}

// Meta Ads e Google Ads generano entrambi campaignId puramente numerici: senza distinguerli per
// canale, una campagna Google Ads con lo stesso numero (per quanto improbabile) di una campagna
// Meta esistente verrebbe silenziosamente confusa con essa in ogni Map/Set chiavata sul solo
// campaignId (spesa/lead attribuiti al tipo_campagna sbagliato). Questa chiave composita è quello
// che elimina davvero il rischio, non solo la presenza della colonna canale — usata ovunque una
// campagna va identificata univocamente tra sedi/canali diversi (qui e in api/kpi/route.ts).
export function chiaveCampagna(canale: Canale | undefined, campaignId: string): string {
  return `${canale ?? "meta"}::${campaignId}`;
}

function meseDiData(data: string): string {
  return data.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
}

/** true se `periodo` (RisultatoCommercialeRow.periodo) è un mese intero ("YYYY-MM", 7 caratteri) —
 * false se è una settimana ("YYYY-MM-DD" di un lunedì, 10 caratteri, selettore periodo a settimane
 * 25/09/2026). Distinzione per lunghezza, mai un parsing di data: una riga mensile storica resta
 * "YYYY-MM" per sempre, vedi il commento su RisultatoCommercialeRow in types/kpi.ts sul perché non
 * viene mai migrata a settimana. */
export function isPeriodoMensile(periodo: string): boolean {
  return periodo.length === 7;
}

/** Mese di appartenenza di un `periodo` — il periodo stesso se è già un mese, altrimenti il mese del
 * lunedì (mai quello dell'ultimo giorno della settimana) — stessa convenzione "il lunedì decide" già
 * in uso per settimanaDiData. Usata per far confluire una riga settimanale nella vista mensile
 * esistente (trend/gruppi per tipo_campagna), mai per il fatturato/appuntamenti mostrati a livello
 * di singola settimana — quelli restano diretti, vedi trendSettimanaleDiretto in computeKpi. */
export function meseDiPeriodo(periodo: string): string {
  return isPeriodoMensile(periodo) ? periodo : periodo.slice(0, 7);
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

/** Ultimo giorno di calendario (YYYY-MM-DD) del mese `mese` (YYYY-MM) — stesso trucco già in uso in api/ghl/route.ts.
 * Esportata anche per meeting.ts (scadenzaFineMese) — nessuna dipendenza da IO qui, sicura da riusare. */
export function ultimoGiornoDelMese(mese: string): string {
  const [anno, m] = mese.split("-").map(Number);
  return new Date(Date.UTC(anno, m, 1) - 1).toISOString().slice(0, 10);
}

/** Lunedì della settimana successiva a `settimana` (YYYY-MM-DD, un lunedì) — solo per scandire la griglia di settimane sotto. */
function settimanaSuccessiva(settimana: string): string {
  return aggiungiGiorni(settimana, 7);
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
    clicLink: 0,
    costoPerClic: null,
    ctrClicLink: null,
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
    costoPerClic: divideOrNull(g.investimento, g.clicLink),
    ctrClicLink: divideOrNull(g.clicLink, g.impressions),
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
  // fatturato: REALE per la sua esatta settimana se esiste una RisultatoCommercialeRow già a
  // periodo settimanale (selettore periodo a settimane, 25/09/2026, vedi trendSettimanaleDiretto in
  // computeKpi) — altrimenti, per le settimane ancora coperte solo da righe MENSILI, resta quello
  // del mese a cui la settimana appartiene (i RisultatiCommerciali mensili non hanno un vero
  // "fatturato della settimana", questa è la stima già in uso: nessuna riga settimanale diretta =
  // stesso comportamento di sempre). Null solo se quel mese non ha proprio un'entrata in trendMap
  // (caso limite). `mese` = mese di appartenenza già risolto qui sotto — esposto perché il chiamante
  // può avere un fatturato mensile alternativo da sovrapporre a questa settimana (vedi
  // kpiGhlOverlay.ts).
  // appuntamentiFissati/appuntamentiEffettuati/numeroVendite seguono ESATTAMENTE lo stesso
  // trattamento di fatturato sopra — servono al blocco 6 del redesign KPI (grafici "Andamento
  // appuntamenti" e "Saldo netto cumulato"), stesso identico caso limite di fatturato.
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
 * Aggrega MetaDaily (spesa/lead, via mapping campagna -> tipo_campagna) e RisultatiCommerciali
 * (richieste/appuntamenti/vendite/fatturato) per una singola sede di un cliente, nella finestra
 * [da, a] inclusiva, raggruppando per tipo_campagna.
 *
 * `da`/`a` sono O due mesi ("YYYY-MM", il modo storico) O due lunedì di settimana ("YYYY-MM-DD",
 * selettore periodo a settimane, 25/09/2026) — SEMPRE la stessa grana per entrambi, rilevata da
 * isPeriodoMensile(da). In modalità settimana: MetaDaily è filtrato su un range di giorni REALE
 * (lunedì di `da` -> domenica di `a`, stessa precisione già in uso in computeSpesaLeadPeriodo sotto)
 * invece che per mese; RisultatiCommerciali considera SOLO le righe già a periodo settimanale il cui
 * lunedì cade in [da, a] — una riga ancora mensile non è attribuibile a una settimana specifica, va
 * esclusa (mai un numero indovinato: il tipo_campagna in questione mostrerà onestamente 0 finché non
 * viene compilata la riga settimanale, stesso comportamento già oggi per un mese senza alcuna riga).
 *
 * Se `campagneSelezionate` è passato, filtra le righe MetaDaily a quelle campagne; un tipo_campagna
 * lato RisultatiCommerciali resta incluso per intero finché almeno una delle sue campagne è nel set
 * (i risultati commerciali non sono tracciati per singola campagna, quindi non sono divisibili
 * ulteriormente).
 */
export function computeKpi(
  clienteId: string,
  sedeId: string,
  da: string,
  a: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  risultatiCommerciali: RisultatoCommercialeRow[],
  campagneSelezionate?: Set<string>
): KpiComputationResult {
  const modoSettimana = !isPeriodoMensile(da);
  const campagneCliente = campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId);
  // Chiave canale::campaignId (vedi chiaveCampagna) — non il solo campaignId: due campagne di
  // canali diversi con lo stesso campaignId non devono mai fondersi nella stessa voce.
  const tipoPerCampagna = new Map(
    campagneCliente.map((c) => [chiaveCampagna(c.canale, c.campaignId), c.tipoCampagna || NON_CLASSIFICATA])
  );
  // Una campagna che non appartiene a questa sede (o non ancora mappata) va sempre esclusa qui —
  // a differenza di prima (un cliente = una sola sede implicita), non basta più "sconosciuta ->
  // Non classificata ma inclusa": finirebbe nei numeri della sede sbagliata.
  const campaignKeysSede = new Set(campagneCliente.map((c) => chiaveCampagna(c.canale, c.campaignId)));
  // campagneSelezionate resta un Set di campaignId nudi (non canale::campaignId): è il filtro a
  // scelta dell'utente in CampagneFilter.tsx, applicato DOPO che la riga è già stata attribuita al
  // tipo_campagna corretto tramite la chiave composita sopra — una collisione di campaignId tra
  // canali diversi (evento comunque improbabile) al più farebbe selezionare/deselezionare insieme
  // due campagne con lo stesso id invece di confondere a quale tipo_campagna appartiene la spesa.
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
  // Sottoinsieme di trendMap alimentato SOLO dalle righe mensili (mai da una riga già a settimana)
  // — usato esclusivamente per la spalmatura sotto (trendSettimanale, settimane senza una riga
  // diretta propria). trendMap "pieno" sopra resta la fonte di gruppi/totale/trend mensile (somma
  // sempre tutto, a prescindere dalla grana della riga): questa mappa separata evita che il dato
  // REALE di una singola settimana migrata venga letto come se fosse "il totale del mese intero" e
  // ri-spalmato per errore sulle settimane sorelle che non hanno ancora un dato proprio.
  const trendMeseSoloMensile = new Map<
    string,
    { fatturato: number; appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number }
  >();
  // speesaPerMese: dentro ogni settimana, quanto investimento viene da ciascun mese — una settimana può
  // ricadere a cavallo di due mesi (bastano poche righe MetaDaily negli ultimi/primi giorni del mese), quindi
  // il solo lunedì della settimana non basta per decidere di quale mese mostrare il fatturato (tracciato solo
  // a livello mensile): si usa il mese con più spesa in quella settimana.
  const trendSettimanaleMap = new Map<string, { investimento: number; numeroLead: number; spesaPerMese: Map<string, number> }>();
  // Righe RisultatoCommercialeRow già a livello di settimana (periodo a 10 caratteri) — join DIRETTO
  // per settimana, mai spalmato sul mese come il resto (vedi il blocco sotto che costruisce
  // trendSettimanale): solo per le settimane che hanno una riga reale, le altre del periodo
  // continuano a usare la spalmatura esistente basata su trendMap/spesaPerMese.
  const trendSettimanaleDiretto = new Map<
    string,
    { fatturato: number; appuntamentiFissati: number; appuntamentiEffettuati: number; numeroVendite: number }
  >();

  // Una entry per OGNI settimana del periodo, non solo quelle con almeno una riga MetaDaily reale
  // — altrimenti un mese con poca spesa sincronizzata avrebbe pochi o un solo punto nel grafico
  // (bug segnalato: "agosto ne ha solo 1??"), e i confini mese del grafico non avrebbero settimane
  // vicine su cui allinearsi. Investimento/numeroLead partono da 0, sovrascritti sotto se esistono
  // righe MetaDaily reali per quella settimana. In modalità settimana `da`/`a` sono già le chiavi-
  // lunedì di inizio/fine, nessuna derivazione da un mese necessaria.
  const primaSettimana = modoSettimana ? da : settimanaDiData(`${da}-01`);
  const ultimaSettimana = modoSettimana ? a : settimanaDiData(ultimoGiornoDelMese(a));
  for (let s = primaSettimana; s <= ultimaSettimana; s = settimanaSuccessiva(s)) {
    trendSettimanaleMap.set(s, { investimento: 0, numeroLead: 0, spesaPerMese: new Map() });
  }

  const nelPeriodoMese = (mese: string) => mese >= da && mese <= a;
  // Solo in modalità settimana: `a` è già un lunedì, la domenica di fine periodo è +6 giorni —
  // stessa precisione di giorno reale già usata in computeSpesaLeadPeriodo sotto.
  const fineGiornoPeriodo = modoSettimana ? aggiungiGiorni(a, 6) : null;

  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    const chiave = chiaveCampagna(row.canale, row.campaignId);
    if (!campaignKeysSede.has(chiave)) continue;
    if (campagneSelezionate && !campagneSelezionate.has(row.campaignId)) continue;
    const mese = meseDiData(row.data);
    const nelPeriodo = modoSettimana ? row.data >= da && row.data <= fineGiornoPeriodo! : nelPeriodoMese(mese);
    if (!nelPeriodo) continue;

    const tipoCampagna = tipoPerCampagna.get(chiave) ?? NON_CLASSIFICATA;
    const gruppo = gruppiMap.get(tipoCampagna) ?? nuovoGruppoVuoto(tipoCampagna);
    gruppo.investimento += row.spesa;
    gruppo.impressions += row.impressions;
    gruppo.numeroLead += row.lead;
    gruppo.clicLink += row.clicLink;
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

  for (const row of risultatiCommerciali) {
    if (row.clienteId !== clienteId) continue;
    if (row.sedeId !== sedeId) continue;

    // In modalità settimana: SOLO le righe già a periodo settimanale contano, e solo se il loro
    // lunedì cade nel range [da, a] (entrambi già lunedì-chiave, confronto diretto) — una riga
    // ancora mensile non è divisibile in settimane, va esclusa qui (vedi il commento in cima alla
    // funzione). In modalità mese: comportamento Fase 1 invariato, una riga settimanale confluisce
    // sotto il mese del suo lunedì (meseDiPeriodo).
    let meseRiga: string;
    if (modoSettimana) {
      if (isPeriodoMensile(row.periodo)) continue;
      if (row.periodo < da || row.periodo > a) continue;
      meseRiga = row.periodo.slice(0, 7);
    } else {
      meseRiga = meseDiPeriodo(row.periodo);
      if (!nelPeriodoMese(meseRiga)) continue;
    }

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
      trendMap.get(meseRiga) ?? { investimento: 0, fatturato: 0, numeroLead: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 };
    trendEntry.fatturato += row.fatturato;
    trendEntry.appuntamentiFissati += row.appuntamentiFissati;
    trendEntry.appuntamentiEffettuati += row.appuntamentiEffettuati;
    trendEntry.numeroVendite += row.vendite;
    trendMap.set(meseRiga, trendEntry);

    if (isPeriodoMensile(row.periodo)) {
      const soloMensileEntry =
        trendMeseSoloMensile.get(meseRiga) ?? { fatturato: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 };
      soloMensileEntry.fatturato += row.fatturato;
      soloMensileEntry.appuntamentiFissati += row.appuntamentiFissati;
      soloMensileEntry.appuntamentiEffettuati += row.appuntamentiEffettuati;
      soloMensileEntry.numeroVendite += row.vendite;
      trendMeseSoloMensile.set(meseRiga, soloMensileEntry);
    } else {
      const settimanaEntry =
        trendSettimanaleDiretto.get(row.periodo) ?? { fatturato: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 };
      settimanaEntry.fatturato += row.fatturato;
      settimanaEntry.appuntamentiFissati += row.appuntamentiFissati;
      settimanaEntry.appuntamentiEffettuati += row.appuntamentiEffettuati;
      settimanaEntry.numeroVendite += row.vendite;
      trendSettimanaleDiretto.set(row.periodo, settimanaEntry);
    }
  }

  const gruppi = Array.from(gruppiMap.values())
    .map(chiudiFormule)
    .sort((a, b) => b.investimento - a.investimento);

  const totaleGrezzo = gruppi.reduce((acc, g) => {
    acc.investimento += g.investimento;
    acc.impressions += g.impressions;
    acc.numeroLead += g.numeroLead;
    acc.clicLink += g.clicLink;
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
      // Una riga RisultatoCommercialeRow già a livello di questa esatta settimana esiste: usa quel
      // dato DIRETTO, reale — mai spalmato dal mese (selettore periodo a settimane, 25/09/2026).
      const diretto = trendSettimanaleDiretto.get(settimana);
      if (diretto) {
        return {
          settimana,
          investimento: v.investimento,
          numeroLead: v.numeroLead,
          fatturato: diretto.fatturato,
          appuntamentiFissati: diretto.appuntamentiFissati,
          appuntamentiEffettuati: diretto.appuntamentiEffettuati,
          numeroVendite: diretto.numeroVendite,
          mese: settimana.slice(0, 7),
        };
      }

      // Nessuna riga settimanale diretta per questa settimana: stessa spalmatura di sempre da una
      // riga mensile (o nessun dato affatto, fatturato null sotto).
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
      // trendMeseSoloMensile (non trendMap): quest'ultima ora può contenere anche righe già a
      // settimana di ALTRE settimane dello stesso mese (selettore periodo a settimane, 25/09/2026)
      // — usarla qui spalmerebbe il dato REALE di una settimana specifica sulle sue sorelle come se
      // fosse un totale mensile, esattamente il falso dato che questa spalmatura esiste per evitare.
      // trendMeseSoloMensile isola solo il contributo delle righe mensili vere.
      const meseSoloMensile = trendMeseSoloMensile.get(meseProprietario);
      return {
        settimana,
        investimento: v.investimento,
        numeroLead: v.numeroLead,
        // i RisultatiCommerciali mensili sono tracciati solo a livello mensile: il fatturato
        // mostrato per una settimana è quello del mese con più spesa in quella settimana (vedi nota
        // sopra su spesaPerMese).
        fatturato: meseSoloMensile?.fatturato ?? null,
        // Stesso trattamento di fatturato sopra — dato mensile ripetuto sul mese proprietario
        // della settimana (vedi tipo KpiComputationResult per il perché).
        appuntamentiFissati: meseSoloMensile?.appuntamentiFissati ?? null,
        appuntamentiEffettuati: meseSoloMensile?.appuntamentiEffettuati ?? null,
        numeroVendite: meseSoloMensile?.numeroVendite ?? null,
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
 * dato che i RisultatiCommerciali (vendite, fatturato, ecc.) sono tracciati solo per tipo_campagna,
 * non per campagna. `da`/`a`: stessa doppia grana mese/settimana di computeKpi sopra (rilevata da
 * isPeriodoMensile(da)) — MetaDaily è sempre giornaliero alla fonte, qui basta scegliere il confronto
 * giusto (mese vs range di giorni reale).
 */
export function computeKpiPerCampagna(
  clienteId: string,
  sedeId: string,
  da: string,
  a: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  campagneSelezionate?: Set<string>,
  ultimoCambioPerCampagna?: Map<string, string>
): RigaCampagna[] {
  const campagneSede = campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId);
  const infoCampagna = new Map(campagneSede.map((c) => [chiaveCampagna(c.canale, c.campaignId), c]));
  const campaignKeysSede = new Set(campagneSede.map((c) => chiaveCampagna(c.canale, c.campaignId)));

  const modoSettimana = !isPeriodoMensile(da);
  const fineGiornoPeriodo = modoSettimana ? aggiungiGiorni(a, 6) : null;
  const nelPeriodo = (row: MetaDailyRow) => (modoSettimana ? row.data >= da && row.data <= fineGiornoPeriodo! : meseDiData(row.data) >= da && meseDiData(row.data) <= a);
  const righeMap = new Map<
    string,
    { campaignId: string; canale: Canale; investimento: number; impressions: number; numeroLead: number; clicLink: number }
  >();

  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    const chiave = chiaveCampagna(row.canale, row.campaignId);
    if (!campaignKeysSede.has(chiave)) continue;
    if (campagneSelezionate && !campagneSelezionate.has(row.campaignId)) continue;
    if (!nelPeriodo(row)) continue;

    const entry =
      righeMap.get(chiave) ??
      { campaignId: row.campaignId, canale: canaleEffettivo(row), investimento: 0, impressions: 0, numeroLead: 0, clicLink: 0 };
    entry.investimento += row.spesa;
    entry.impressions += row.impressions;
    entry.numeroLead += row.lead;
    entry.clicLink += row.clicLink;
    righeMap.set(chiave, entry);
  }

  return Array.from(righeMap.entries())
    .map(([chiave, v]) => {
      const info = infoCampagna.get(chiave);
      const cpmRatio = divideOrNull(v.investimento, v.impressions);
      return {
        campaignId: v.campaignId,
        canale: v.canale,
        nomeCampagna: info?.nomeCampagna ?? v.campaignId,
        tipoCampagna: info?.tipoCampagna || NON_CLASSIFICATA,
        stato: info?.stato ?? "",
        statoDal: ultimoCambioPerCampagna?.get(v.campaignId) ?? null,
        investimento: v.investimento,
        impressions: v.impressions,
        cpm: cpmRatio === null ? null : cpmRatio * 1000,
        numeroLead: v.numeroLead,
        costoPerLead: divideOrNull(v.investimento, v.numeroLead),
        clicLink: v.clicLink,
        costoPerClic: divideOrNull(v.investimento, v.clicLink),
        ctrClicLink: divideOrNull(v.clicLink, v.impressions),
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
 * "salute clienti" a 7 giorni. Le vendite dei RisultatiCommerciali sono tracciate solo a livello
 * mensile, quindi su una finestra sub-mensile non sono attendibili: qui il segnale è sempre il
 * costo per lead. MetaDaily non porta sedeId: si passa da campagne (campaignId -> sede) come nelle
 * altre funzioni.
 */
export function computeSpesaLeadPeriodo(
  clienteId: string,
  sedeId: string,
  daData: string, // YYYY-MM-DD
  aData: string, // YYYY-MM-DD
  metaDaily: MetaDailyRow[],
  campagne: Campagna[]
): { investimento: number; numeroLead: number; costoPerLead: number | null } {
  const campaignKeysSede = new Set(
    campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId).map((c) => chiaveCampagna(c.canale, c.campaignId))
  );
  let investimento = 0;
  let numeroLead = 0;
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignKeysSede.has(chiaveCampagna(row.canale, row.campaignId))) continue;
    if (row.data < daData || row.data > aData) continue;
    investimento += row.spesa;
    numeroLead += row.lead;
  }
  return { investimento, numeroLead, costoPerLead: divideOrNull(investimento, numeroLead) };
}
