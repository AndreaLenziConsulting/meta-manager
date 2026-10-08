import { sqlInserimento, TABELLE, type RigaTabella } from "@/lib/db/tabelle";
import type { Database, Esegui } from "@/lib/db/tipi";
import type { CambioStatoCampagna } from "@/lib/sheets";
import type {
  AttivitaClienteRow,
  Campagna,
  CategoriaCommerciale,
  Cliente,
  Consulente,
  CredenzialeAccesso,
  FaseCompletataRow,
  MetaDailyRow,
  Prodotto,
  RisultatoCommercialeRow,
  RisultatoVenditoreRow,
  Sede,
  TemplateTask,
  Venditore,
} from "@/types/kpi";
import type { MeetingClienteRow } from "@/types/meeting";
import type { Commerciale, Prospect, ReportCommercialeRow } from "@/types/prospect";
import type { GhlConnessione } from "@/types/ghl";
import type { ConnessioneCanale } from "@/types/connessioniCanale";

/**
 * Copia dei dati dal foglio Google al database (una tantum, al passaggio a Supabase).
 *
 * Due passi separati:
 *   1. `preparaCopia` — pura: dai dati letti dal foglio (gli stessi oggetti che l'app usa oggi)
 *      alle righe di ogni tabella. Ciò che il database non può accogliere NON sparisce in silenzio:
 *      finisce in `scartate`, con tabella, identificativo e motivo (una connessione di una sede che
 *      non esiste più, una data illeggibile…).
 *   2. `eseguiCopia` — scrive tutto in una sola transazione e poi riconta: se una tabella non ha
 *      tante righe quante ne sono state preparate, la transazione fallisce e il database resta
 *      com'era.
 *
 * Non è un meccanismo di sincronizzazione: su un database che contiene già dati si rifiuta, a meno
 * di chiedere esplicitamente di sovrascrivere.
 */
export type DatiFoglio = {
  consulenti: Consulente[];
  commerciali: Commerciale[];
  /** Le password così come sono scritte nel foglio: lette a parte, non stanno in Consulente/Commerciale. */
  credenziali: CredenzialeAccesso[];
  prodotti: Prodotto[];
  templateAttivita: TemplateTask[];
  clienti: Cliente[];
  sedi: Sede[];
  ghlConnessioni: GhlConnessione[];
  connessioniCanale: ConnessioneCanale[];
  categorieCommerciali: CategoriaCommerciale[];
  venditori: Venditore[];
  campagne: Campagna[];
  storicoStato: CambioStatoCampagna[];
  metaDaily: MetaDailyRow[];
  risultatiCommerciali: RisultatoCommercialeRow[];
  risultatiVenditori: RisultatoVenditoreRow[];
  attivita: AttivitaClienteRow[];
  fasiCompletate: FaseCompletataRow[];
  meeting: MeetingClienteRow[];
  prospect: Prospect[];
  reportCommerciale: ReportCommercialeRow[];
};

export type RigaScartata = { tabella: string; id: string; motivo: string };
export type CopiaPreparata = {
  tabelle: Record<string, RigaTabella[]>;
  /** Righe del foglio che il database non può accogliere, con il motivo. */
  scartate: RigaScartata[];
  /** Cose aggiustate senza perdere la riga (un decimale dove serve un intero, un doppione sovrascritto). */
  avvisi: string[];
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Stringa vuota → null: per le colonne data/ora, dove "" non è un valore valido. */
function oNull(v: string | null | undefined): string | null {
  return v ? v : null;
}

export function preparaCopia(dati: DatiFoglio): CopiaPreparata {
  const scartate: RigaScartata[] = [];
  const avvisi: string[] = [];
  const arrotondati = new Map<string, number>();
  const interoDa = (v: number, dove: string): number => {
    const n = Number.isFinite(v) ? v : 0;
    if (!Number.isInteger(n)) arrotondati.set(dove, (arrotondati.get(dove) ?? 0) + 1);
    return Math.round(n);
  };

  const idClienti = new Set(dati.clienti.map((c) => c.clienteId));
  const idProdotti = new Set(dati.prodotti.map((p) => p.prodottoId));
  const idProspect = new Set(dati.prospect.map((p) => p.prospectId));

  /** Tiene le righe che superano tutti i controlli; le altre finiscono fra le scartate col primo motivo che non passa. */
  function tieni<T>(tabella: string, righe: T[], id: (r: T) => string, controlli: [(r: T) => boolean, string][]): T[] {
    return righe.filter((r) => {
      const fallito = controlli.find(([ok]) => !ok(r));
      if (fallito) scartate.push({ tabella, id: id(r), motivo: fallito[1] });
      return !fallito;
    });
  }

  const sedi = tieni("sedi", dati.sedi, (s) => s.sedeId, [[(s) => idClienti.has(s.clienteId), "il cliente non esiste più"]]);
  const idSedi = new Set(sedi.map((s) => s.sedeId));
  const sedeEsiste: [(r: { sedeId: string }) => boolean, string] = [(r) => idSedi.has(r.sedeId), "la sede non esiste più"];
  const clienteEsiste: [(r: { clienteId: string }) => boolean, string] = [(r) => idClienti.has(r.clienteId), "il cliente non esiste più"];

  const venditori = tieni("venditori", dati.venditori, (v) => v.venditoreId, [sedeEsiste]);
  const idVenditori = new Set(venditori.map((v) => v.venditoreId));

  // Dati giornalieri: stessa chiave della sincronizzazione (canale, cliente, campagna, giorno). Se il
  // foglio ne ha due con la stessa chiave vale l'ultima, come farebbe la sincronizzazione.
  const giornalieri = new Map<string, MetaDailyRow>();
  let doppioniGiornalieri = 0;
  for (const r of tieni("meta_daily", dati.metaDaily, (r) => `${r.clienteId}/${r.campaignId}/${r.data}`, [[(r) => DATA_ISO.test(r.data), "data illeggibile"]])) {
    const chiave = `${r.canale ?? "meta"}|${r.clienteId}|${r.campaignId}|${r.data}`;
    if (giornalieri.has(chiave)) doppioniGiornalieri++;
    giornalieri.set(chiave, r);
  }
  if (doppioniGiornalieri > 0) avvisi.push(`meta_daily: ${doppioniGiornalieri} righe con la stessa chiave di un'altra; tenuta l'ultima.`);

  const password = new Map(dati.credenziali.map((c) => [`${c.ruolo}/${c.id}`, c.password]));
  const tabelle: Record<string, RigaTabella[]> = {
    consulenti: dati.consulenti.map((c) => ({
      consulente_id: c.consulenteId,
      nome: c.nome,
      password: password.get(`consulente/${c.consulenteId}`) ?? "",
      attivo: c.attivo,
      email: c.email,
    })),
    commerciali: dati.commerciali.map((c) => ({
      commerciale_id: c.commercialeId,
      nome: c.nome,
      password: password.get(`commerciale/${c.commercialeId}`) ?? "",
      attivo: c.attivo,
      email: c.email,
    })),
    prodotti: dati.prodotti.map((p) => ({
      prodotto_id: p.prodottoId,
      nome: p.nome,
      attivo: p.attivo,
      durata_settimane: interoDa(p.durataSettimane, "prodotti.durata_settimane"),
      note: p.note,
    })),
    template_attivita: tieni("template_attivita", dati.templateAttivita, (t) => `${t.prodottoId}/${t.taskId}`, [
      [(t) => idProdotti.has(t.prodottoId), "il prodotto non esiste più"],
    ]).map((t) => ({
      prodotto_id: t.prodottoId,
      task_id: t.taskId,
      blocco: t.blocco,
      fase: t.fase,
      descrizione: t.descrizione,
      assegnatari: t.assegnatari,
      tipo: t.tipo,
      settimana_inizio: interoDa(t.settimanaInizio, "template_attivita.settimana_inizio"),
      settimana_fine: interoDa(t.settimanaFine, "template_attivita.settimana_fine"),
      giorni_testo: t.giorniTesto,
      nota: t.nota,
      ordine: interoDa(t.ordine, "template_attivita.ordine"),
    })),
    clienti: dati.clienti.map((c) => ({
      cliente_id: c.clienteId,
      nome: c.nome,
      access_code: c.accessCode,
      attivo: c.attivo,
      consulente_id: c.consulenteId,
      mostra_tab_extra: c.mostraTabExtra,
      prodotto_id: c.prodottoId,
      data_inizio_progetto: oNull(c.dataInizioProgetto),
      email: c.email,
      logo_url: c.logoUrl,
      colore_primario: c.colorePrimario,
      colore_secondario: c.coloreSecondario,
      font_personalizzato: c.fontPersonalizzato,
      drive_folder_url: c.driveFolderUrl,
      landing_page_url: c.landingPageUrl,
      appuntamenti_file_url: c.appuntamentiFileUrl,
      funnels: c.funnels ?? [],
    })),
    sedi: sedi.map((s) => ({
      sede_id: s.sedeId,
      cliente_id: s.clienteId,
      nome: s.nome,
      ad_account_id: s.adAccountId,
      target_cpa: s.targetCpa,
      target_cpl: s.targetCpl,
      tipo_conversione_lead: s.tipoConversioneLead,
      attivo: s.attivo,
      target_budget_mensile: s.targetBudgetMensile,
      target_lead_settimana: s.targetLeadSettimana,
      target_appuntamenti_settimana: s.targetAppuntamentiSettimana,
      target_fatturato_mensile: s.targetFatturatoMensile,
      tutte_le_campagne: Boolean(s.tutteLeCampagne),
    })),
    ghl_connessioni: tieni("ghl_connessioni", dati.ghlConnessioni, (g) => g.connessioneId, [sedeEsiste]).map((g) => ({
      connessione_id: g.connessioneId,
      sede_id: g.sedeId,
      location_id: g.locationId,
      private_token: g.privateToken,
      attivo: g.attivo,
      note: g.note,
      creata_il: oNull(g.creataIl),
      calendar_ids: g.calendarIds ?? [],
      pipeline_ids: g.pipelineIds ?? [],
    })),
    connessioni_canale: tieni("connessioni_canale", dati.connessioniCanale, (c) => c.connessioneId, [sedeEsiste]).map((c) => ({
      connessione_id: c.connessioneId,
      sede_id: c.sedeId,
      canale: c.canale,
      account_id: c.accountId,
      tipo_conversione_lead: c.tipoConversioneLead,
      attivo: c.attivo,
      note: c.note,
      creata_il: oNull(c.creataIl),
    })),
    categorie_commerciali: tieni("categorie_commerciali", dati.categorieCommerciali, (c) => c.categoriaId, [sedeEsiste]).map((c) => ({
      categoria_id: c.categoriaId,
      sede_id: c.sedeId,
      nome: c.nome,
      tag_ghl: c.tagGhl,
      pipeline_ghl: c.pipelineGhl ?? "",
      attivo: c.attivo,
      ordine: interoDa(c.ordine, "categorie_commerciali.ordine"),
      target_budget_mensile: c.targetBudgetMensile,
      target_lead_settimana: c.targetLeadSettimana,
      target_appuntamenti_settimana: c.targetAppuntamentiSettimana,
      target_fatturato_mensile: c.targetFatturatoMensile,
    })),
    venditori: venditori.map((v) => ({
      venditore_id: v.venditoreId,
      sede_id: v.sedeId,
      nome: v.nome,
      capienza_appuntamenti_mensile: v.capienzaAppuntamentiMensile,
      attivo: v.attivo,
      ghl_user_id: v.ghlUserId ?? "",
    })),
    // Campagne, storico e dati giornalieri: nessuno scarto per sede o cliente mancanti. È storico
    // che l'app conserva di proposito anche dopo l'eliminazione di una sede.
    campagne: dati.campagne.map((c) => ({
      canale: c.canale ?? "meta",
      campaign_id: c.campaignId,
      cliente_id: c.clienteId,
      sede_id: c.sedeId,
      nome_campagna: c.nomeCampagna,
      tipo_campagna: c.tipoCampagna,
      stato: c.stato,
    })),
    storico_stato_campagne: tieni("storico_stato_campagne", dati.storicoStato, (s) => `${s.campaignId}/${s.cambiatoIl}`, [
      [(s) => !Number.isNaN(Date.parse(s.cambiatoIl)), "data e ora illeggibili"],
    ]).map((s) => ({
      cambiato_il: s.cambiatoIl,
      campaign_id: s.campaignId,
      cliente_id: s.clienteId,
      nome_campagna: s.nomeCampagna,
      stato_precedente: s.statoPrecedente,
      stato_nuovo: s.statoNuovo,
    })),
    meta_daily: Array.from(giornalieri.values()).map((r) => ({
      canale: r.canale ?? "meta",
      cliente_id: r.clienteId,
      campaign_id: r.campaignId,
      data: r.data,
      spesa: r.spesa,
      impressions: interoDa(r.impressions, "meta_daily.impressions"),
      clicks: interoDa(r.clicks, "meta_daily.clicks"),
      ctr: r.ctr,
      cpc: r.cpc,
      cpm: r.cpm,
      lead: r.lead,
      clic_link: interoDa(r.clicLink, "meta_daily.clic_link"),
    })),
    risultati_commerciali: tieni("risultati_commerciali", dati.risultatiCommerciali, (r) => `${r.clienteId}/${r.sedeId}/${r.periodo}/${r.tipoCampagna}`, [
      clienteEsiste,
      [(r) => /^\d{4}-\d{2}(-\d{2})?$/.test(r.periodo), "periodo illeggibile"],
    ]).map((r) => ({
      periodo: r.periodo,
      cliente_id: r.clienteId,
      sede_id: r.sedeId,
      tipo_campagna: r.tipoCampagna,
      richieste: r.richieste,
      appuntamenti_fissati: r.appuntamentiFissati,
      appuntamenti_effettuati: r.appuntamentiEffettuati,
      vendite: r.vendite,
      fatturato: r.fatturato,
    })),
    risultati_venditori: tieni("risultati_venditori", dati.risultatiVenditori, (r) => `${r.venditoreId}/${r.mese}`, [
      [(r) => idVenditori.has(r.venditoreId), "il venditore non esiste più"],
      [(r) => /^\d{4}-\d{2}$/.test(r.mese), "mese illeggibile"],
    ]).map((r) => ({
      mese: r.mese,
      sede_id: r.sedeId,
      venditore_id: r.venditoreId,
      appuntamenti_fissati: r.appuntamentiFissati,
      vendite: r.vendite,
      fatturato: r.fatturato,
    })),
    attivita_cliente: tieni("attivita_cliente", dati.attivita, (a) => a.attivitaId, [
      clienteEsiste,
      [(a) => DATA_ISO.test(a.dataInizio) && DATA_ISO.test(a.dataFine), "date illeggibili"],
    ]).map((a) => ({
      attivita_id: a.attivitaId,
      cliente_id: a.clienteId,
      prodotto_id: a.prodottoId,
      task_id: a.taskId,
      blocco: a.blocco,
      fase: a.fase,
      descrizione: a.descrizione,
      assegnatari: a.assegnatari,
      tipo: a.tipo,
      data_inizio: a.dataInizio,
      data_fine: a.dataFine,
      stato: a.stato,
      nota_team: a.notaTeam,
      ordine: interoDa(a.ordine, "attivita_cliente.ordine"),
    })),
    fasi_completate: tieni("fasi_completate", dati.fasiCompletate, (f) => `${f.clienteId}/${f.fase}`, [
      clienteEsiste,
      [(f) => DATA_ISO.test(f.completataIl), "data illeggibile"],
    ]).map((f) => ({ cliente_id: f.clienteId, fase: f.fase, completata_il: f.completataIl })),
    meeting_cliente: tieni("meeting_cliente", dati.meeting, (m) => m.meetingId, [clienteEsiste, [(m) => DATA_ISO.test(m.data), "data illeggibile"]]).map((m) => ({
      meeting_id: m.meetingId,
      cliente_id: m.clienteId,
      data: m.data,
      titolo: m.titolo,
      sentiment: m.sentiment,
      aggiornato_il: oNull(m.aggiornatoIl),
      dati: m.dati ?? {},
    })),
    prospect: dati.prospect.map((p) => ({
      prospect_id: p.prospectId,
      ragione_sociale: p.ragioneSociale,
      nome_contatto: p.nomeContatto,
      tipo_business: p.tipoBusiness,
      fatturato: p.fatturato,
      sedi: p.sedi,
      email: p.email,
      commerciale_id: p.commercialeId,
      attivo: p.attivo,
      creato_il: oNull(p.creatoIl),
      drive_folder_url: p.driveFolderUrl,
      media_budget_mensile: p.mediaBudgetMensile,
      target_cpl: p.targetCpl,
      target_cpa_appuntamento: p.targetCpaAppuntamento,
      target_lead_settimana: p.targetLeadSettimana,
      target_appuntamenti_settimana: p.targetAppuntamentiSettimana,
      target_fatturato_mensile: p.targetFatturatoMensile,
      target_margine_vendita_pct: p.targetMargineVenditaPct,
      cliente_id: p.clienteId,
      consulente_suggerito_id: p.consulenteSuggeritoId,
      calcolatore_budget: p.calcolatoreBudget,
    })),
    report_commerciale: tieni("report_commerciale", dati.reportCommerciale, (r) => r.reportId, [
      [(r) => idProspect.has(r.prospectId), "il prospect non esiste più"],
      [(r) => DATA_ISO.test(r.data), "data illeggibile"],
    ]).map((r) => ({
      report_id: r.reportId,
      prospect_id: r.prospectId,
      commerciale_id: r.commercialeId,
      data: r.data,
      aggiornato_il: oNull(r.aggiornatoIl),
      dati: r.dati ?? {},
    })),
  };

  for (const [dove, quante] of arrotondati) avvisi.push(`${dove}: ${quante} valori con decimali arrotondati all'intero.`);
  return { tabelle, scartate, avvisi };
}

const RIGHE_PER_LOTTO = 1000;

async function conta(esegui: Esegui, tabella: string): Promise<number> {
  const [riga] = await esegui<{ n: number | string }>(`select count(*)::int as n from public.${tabella}`);
  return Number(riga.n);
}

export type EsitoCopia = {
  /** Righe scritte per tabella (già ricontate nel database). */
  scritte: Record<string, number>;
  scartate: RigaScartata[];
  avvisi: string[];
};

/**
 * Scrive nel database la copia preparata. Tutto in una transazione: o entra tutto, o niente.
 * Su un database che ha già dati si ferma, a meno di `sovrascrivi: true` (che lo svuota prima).
 */
export async function eseguiCopia(db: Database, dati: DatiFoglio, opzioni: { sovrascrivi?: boolean } = {}): Promise<EsitoCopia> {
  const preparata = preparaCopia(dati);
  const scritte: Record<string, number> = {};

  await db.transazione(async ({ esegui }) => {
    const piene: string[] = [];
    for (const t of TABELLE) if ((await conta(esegui, t.nome)) > 0) piene.push(t.nome);
    if (piene.length > 0) {
      if (!opzioni.sovrascrivi) {
        throw new Error(`Il database contiene già dati (${piene.join(", ")}): la copia si ferma per non sovrascriverli.`);
      }
      await esegui(`truncate ${TABELLE.map((t) => `public.${t.nome}`).join(", ")} restart identity cascade`);
    }

    for (const t of TABELLE) {
      const righe = preparata.tabelle[t.nome] ?? [];
      const sql = sqlInserimento(t);
      for (let i = 0; i < righe.length; i += RIGHE_PER_LOTTO) {
        await esegui(sql, [JSON.stringify(righe.slice(i, i + RIGHE_PER_LOTTO))]);
      }
      const nelDatabase = await conta(esegui, t.nome);
      if (nelDatabase !== righe.length) {
        throw new Error(`${t.nome}: preparate ${righe.length} righe, nel database ce ne sono ${nelDatabase}. Copia annullata.`);
      }
      scritte[t.nome] = nelDatabase;
    }
  });

  return { scritte, scartate: preparata.scartate, avvisi: preparata.avvisi };
}
