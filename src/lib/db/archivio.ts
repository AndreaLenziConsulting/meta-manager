import type * as Foglio from "@/lib/sheets";
import { database } from "@/lib/db/connessione";
import { sqlAggiornamento, sqlInserimento, sqlLettura, tabella, type RigaTabella } from "@/lib/db/tabelle";
import type { Sessione } from "@/lib/db/tipi";
import { SENTINELLA_NON_ASSEGNATO } from "@/lib/assegnatari";
import { estraiMeetingIdDaTaskId } from "@/lib/meeting";
import type { AttivitaClienteRow, Canale, Cliente, CredenzialeAccesso, RuoloSquadra, StatoAttivita } from "@/types/kpi";
import { normalizzaStadi } from "@/lib/ghlStadi";
import type { MeetingDataLoose } from "@/types/meeting";
import type { Prospect, ReportCommercialeDataLoose } from "@/types/prospect";

/**
 * L'archivio dell'app sul database Postgres: le stesse funzioni di src/lib/sheets.ts, con la stessa
 * firma (ogni funzione è dichiarata `typeof Foglio.<nome>`: se una delle due cambia, non compila),
 * gli stessi valori di ritorno e gli stessi messaggi d'errore. Chi le chiama non sa su quale dei due
 * archivi sta lavorando: lo decide src/lib/archivio.ts.
 *
 * Differenze volute rispetto al foglio:
 *   - nessuna cache: ogni lettura è una query, sempre aggiornata. `noCache` viene accettato e ignorato;
 *   - le eliminazioni a cascata le fa il database (chiavi esterne), in un colpo solo;
 *   - eliminare una sede porta via anche le sue connessioni ai canali pubblicitari, che nel foglio
 *     restavano orfane;
 *   - le due migrazioni che riparavano la struttura del foglio (sedi "vestigiali", assegnatari scritti
 *     a mano) qui non hanno nulla da riparare e non fanno nulla.
 */

// ───────────────────────── Strumenti ─────────────────────────

const testo = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const numero = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const numeroONull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const intero = (v: number): number => Math.round(Number.isFinite(v) ? v : 0);
/** Nessun assegnatario = "Da assegnare", come nel foglio (una cella vuota veniva letta così). */
const assegnatari = (v: unknown): string[] => {
  const nomi = lista(v).filter(Boolean);
  return nomi.length > 0 ? nomi : [SENTINELLA_NON_ASSEGNATO];
};

function leggi(nome: string, dove = "", parametri: unknown[] = [], s: Sessione = database()): Promise<RigaTabella[]> {
  return s.esegui(sqlLettura(tabella(nome), dove), parametri);
}

const RIGHE_PER_LOTTO = 1000;

/** Inserisce le righe e torna quante ne sono entrate davvero (meno delle proposte, se `seEsiste` ne ignora). */
async function inserisci(nome: string, righe: RigaTabella[], seEsiste = "", s: Sessione = database()): Promise<number> {
  let inserite = 0;
  for (let i = 0; i < righe.length; i += RIGHE_PER_LOTTO) {
    const esito = await s.esegui(`${sqlInserimento(tabella(nome), seEsiste)} returning 1 as ok`, [JSON.stringify(righe.slice(i, i + RIGHE_PER_LOTTO))]);
    inserite += esito.length;
  }
  return inserite;
}

/** Aggiorna solo i campi definiti (un campo `undefined` resta com'è). Torna quante righe ha trovato. */
async function aggiorna(nome: string, chiave: RigaTabella, campi: RigaTabella, s: Sessione = database()): Promise<number> {
  const daImpostare = Object.keys(campi).filter((k) => campi[k] !== undefined);
  if (daImpostare.length === 0) return 0;
  const record: RigaTabella = { ...chiave };
  for (const k of daImpostare) record[k] = campi[k];
  const esito = await s.esegui(sqlAggiornamento(tabella(nome), Object.keys(chiave), daImpostare), [JSON.stringify(record)]);
  return esito.length;
}

async function esiste(nome: string, colonna: string, valore: string, s: Sessione = database()): Promise<boolean> {
  return (await s.esegui(`select 1 as ok from public.${nome} where ${colonna} = $1 limit 1`, [valore])).length > 0;
}

async function elimina(nome: string, colonna: string, valore: string, s: Sessione = database()): Promise<number> {
  return (await s.esegui(`delete from public.${nome} where ${colonna} = $1 returning 1 as ok`, [valore])).length;
}

/** Elimina una riga per identificativo; se non c'è, lo stesso errore che dava il foglio (col nome della scheda). */
async function eliminaPerId(nome: string, scheda: string, colonna: string, id: string): Promise<void> {
  if ((await elimina(nome, colonna, id)) === 0) throw new Error(`Riga non trovata in ${scheda}: ${id}`);
}

// ───────────────────────── Clienti ─────────────────────────

function clienteDa(r: RigaTabella): Cliente {
  return {
    clienteId: testo(r.cliente_id),
    nome: testo(r.nome),
    accessCode: testo(r.access_code),
    attivo: Boolean(r.attivo),
    consulenteId: testo(r.consulente_id),
    mostraTabExtra: Boolean(r.mostra_tab_extra),
    prodottoId: testo(r.prodotto_id),
    dataInizioProgetto: testo(r.data_inizio_progetto) || null,
    email: testo(r.email),
    logoUrl: testo(r.logo_url),
    colorePrimario: testo(r.colore_primario),
    coloreSecondario: testo(r.colore_secondario),
    fontPersonalizzato: testo(r.font_personalizzato),
    driveFolderUrl: testo(r.drive_folder_url),
    landingPageUrl: testo(r.landing_page_url),
    appuntamentiFileUrl: testo(r.appuntamenti_file_url),
    funnels: Array.isArray(r.funnels) ? (r.funnels as Cliente["funnels"]) : [],
  };
}

export const getClienti: typeof Foglio.getClienti = async () => (await leggi("clienti")).map(clienteDa);

export const getClienteByAccessCode: typeof Foglio.getClienteByAccessCode = async (code) => {
  const [riga] = await leggi("clienti", "access_code = $1", [code]);
  return riga ? clienteDa(riga) : null;
};

export const creaCliente: typeof Foglio.creaCliente = async (input) => {
  if (await esiste("clienti", "cliente_id", input.clienteId)) {
    throw new Error(`Esiste già un cliente con id "${input.clienteId}"`);
  }
  await inserisci("clienti", [
    {
      cliente_id: input.clienteId,
      nome: input.nome,
      access_code: input.accessCode,
      attivo: true,
      consulente_id: input.consulenteId,
      mostra_tab_extra: input.mostraTabExtra,
      prodotto_id: input.prodottoId,
      data_inizio_progetto: input.dataInizioProgetto || null,
      email: input.email ?? "",
      logo_url: input.logoUrl ?? "",
      colore_primario: input.colorePrimario ?? "",
      colore_secondario: input.coloreSecondario ?? "",
      font_personalizzato: input.fontPersonalizzato ?? "",
      drive_folder_url: input.driveFolderUrl ?? "",
      landing_page_url: input.landingPageUrl ?? "",
      appuntamenti_file_url: input.appuntamentiFileUrl ?? "",
      funnels: [],
    },
  ]);
};

export const aggiornaCliente: typeof Foglio.aggiornaCliente = async (input) => {
  if (!(await esiste("clienti", "cliente_id", input.clienteId))) {
    throw new Error(`Cliente non trovato: ${input.clienteId}`);
  }
  await aggiorna(
    "clienti",
    { cliente_id: input.clienteId },
    {
      nome: input.nome,
      attivo: input.attivo,
      consulente_id: input.consulenteId,
      mostra_tab_extra: input.mostraTabExtra,
      email: input.email,
      logo_url: input.logoUrl,
      colore_primario: input.colorePrimario,
      colore_secondario: input.coloreSecondario,
      font_personalizzato: input.fontPersonalizzato,
      drive_folder_url: input.driveFolderUrl,
      landing_page_url: input.landingPageUrl,
      appuntamenti_file_url: input.appuntamentiFileUrl,
      funnels: input.funnels,
    }
  );
};

export const migraFunnelClientiEsistenti: typeof Foglio.migraFunnelClientiEsistenti = async () => {
  let migrati = 0;
  for (const c of await getClienti()) {
    if (c.funnels.length > 0 || !c.landingPageUrl.trim()) continue;
    await aggiornaCliente({ clienteId: c.clienteId, funnels: [{ id: crypto.randomUUID(), nome: "Landing page", url: c.landingPageUrl.trim() }] });
    migrati++;
  }
  return { migrati };
};

/** Sedi, connessioni, categorie, venditori, attività, meeting, tappe e risultati commerciali del
 * cliente se ne vanno con lui (chiavi esterne). Campagne e dati giornalieri restano: è storico. */
export const eliminaCliente: typeof Foglio.eliminaCliente = async (clienteId) => {
  if ((await elimina("clienti", "cliente_id", clienteId)) === 0) throw new Error(`Cliente non trovato: ${clienteId}`);
};

// ───────────────────────── Sedi ─────────────────────────

export const getSedi: typeof Foglio.getSedi = async () =>
  (await leggi("sedi")).map((r) => ({
    sedeId: testo(r.sede_id),
    clienteId: testo(r.cliente_id),
    nome: testo(r.nome),
    adAccountId: testo(r.ad_account_id),
    targetCpa: numeroONull(r.target_cpa),
    targetCpl: numeroONull(r.target_cpl),
    tipoConversioneLead: testo(r.tipo_conversione_lead),
    attivo: Boolean(r.attivo),
    targetBudgetMensile: numeroONull(r.target_budget_mensile),
    targetLeadSettimana: numeroONull(r.target_lead_settimana),
    targetAppuntamentiSettimana: numeroONull(r.target_appuntamenti_settimana),
    targetFatturatoMensile: numeroONull(r.target_fatturato_mensile),
    tutteLeCampagne: Boolean(r.tutte_le_campagne),
  }));

export const creaSede: typeof Foglio.creaSede = async (input) => {
  if (await esiste("sedi", "sede_id", input.sedeId)) {
    throw new Error(`Esiste già una sede con id "${input.sedeId}"`);
  }
  await inserisci("sedi", [
    {
      sede_id: input.sedeId,
      cliente_id: input.clienteId,
      nome: input.nome,
      ad_account_id: input.adAccountId,
      target_cpa: input.targetCpa ?? null,
      target_cpl: input.targetCpl ?? null,
      tipo_conversione_lead: input.tipoConversioneLead ?? "",
      attivo: true,
      target_budget_mensile: input.targetBudgetMensile ?? null,
      target_lead_settimana: input.targetLeadSettimana ?? null,
      target_appuntamenti_settimana: input.targetAppuntamentiSettimana ?? null,
      target_fatturato_mensile: input.targetFatturatoMensile ?? null,
      tutte_le_campagne: false,
    },
  ]);
};

export const aggiornaSede: typeof Foglio.aggiornaSede = async (input) => {
  if (!(await esiste("sedi", "sede_id", input.sedeId))) {
    throw new Error(`Sede non trovata: ${input.sedeId}`);
  }
  await aggiorna(
    "sedi",
    { sede_id: input.sedeId },
    {
      nome: input.nome,
      ad_account_id: input.adAccountId,
      target_cpa: input.targetCpa,
      target_cpl: input.targetCpl,
      tipo_conversione_lead: input.tipoConversioneLead,
      attivo: input.attivo,
      target_budget_mensile: input.targetBudgetMensile,
      target_lead_settimana: input.targetLeadSettimana,
      target_appuntamenti_settimana: input.targetAppuntamentiSettimana,
      target_fatturato_mensile: input.targetFatturatoMensile,
      tutte_le_campagne: input.tutteLeCampagne,
    }
  );
};

export const eliminaSede: typeof Foglio.eliminaSede = async (sedeId) => {
  if ((await elimina("sedi", "sede_id", sedeId)) === 0) throw new Error(`Sede non trovata: ${sedeId}`);
};

// ───────────────────────── Connessioni GHL ─────────────────────────

export const getGhlConnessioni: typeof Foglio.getGhlConnessioni = async () =>
  (await leggi("ghl_connessioni")).map((r) => ({
    connessioneId: testo(r.connessione_id),
    sedeId: testo(r.sede_id),
    locationId: testo(r.location_id),
    privateToken: testo(r.private_token),
    attivo: Boolean(r.attivo),
    note: testo(r.note),
    creataIl: testo(r.creata_il),
    calendarIds: lista(r.calendar_ids),
    pipelineIds: lista(r.pipeline_ids),
    stadi: normalizzaStadi(r.stadi),
  }));

export const creaGhlConnessione: typeof Foglio.creaGhlConnessione = async (input) => {
  if (await esiste("ghl_connessioni", "connessione_id", input.connessioneId)) {
    throw new Error(`Esiste già una connessione GHL con id "${input.connessioneId}"`);
  }
  await inserisci("ghl_connessioni", [
    {
      connessione_id: input.connessioneId,
      sede_id: input.sedeId,
      location_id: input.locationId,
      private_token: input.privateToken,
      attivo: true,
      note: input.note ?? "",
      creata_il: new Date().toISOString(),
      calendar_ids: [],
      pipeline_ids: [],
    },
  ]);
};

export const aggiornaGhlConnessione: typeof Foglio.aggiornaGhlConnessione = async (input) => {
  if (!(await esiste("ghl_connessioni", "connessione_id", input.connessioneId))) {
    throw new Error(`Connessione GHL non trovata: ${input.connessioneId}`);
  }
  await aggiorna(
    "ghl_connessioni",
    { connessione_id: input.connessioneId },
    {
      location_id: input.locationId,
      private_token: input.privateToken,
      attivo: input.attivo,
      note: input.note,
      calendar_ids: input.calendarIds,
      pipeline_ids: input.pipelineIds,
      stadi: input.stadi,
    }
  );
};

export const eliminaGhlConnessione: typeof Foglio.eliminaGhlConnessione = (connessioneId) =>
  eliminaPerId("ghl_connessioni", "GhlConnessioni", "connessione_id", connessioneId);

// ───────────────────────── Categorie commerciali ─────────────────────────

export const getCategorieCommerciali: typeof Foglio.getCategorieCommerciali = async () =>
  (await leggi("categorie_commerciali"))
    .map((r) => ({
      categoriaId: testo(r.categoria_id),
      sedeId: testo(r.sede_id),
      nome: testo(r.nome),
      tagGhl: testo(r.tag_ghl),
      attivo: Boolean(r.attivo),
      ordine: numero(r.ordine),
      targetBudgetMensile: numeroONull(r.target_budget_mensile),
      targetLeadSettimana: numeroONull(r.target_lead_settimana),
      targetAppuntamentiSettimana: numeroONull(r.target_appuntamenti_settimana),
      targetFatturatoMensile: numeroONull(r.target_fatturato_mensile),
      pipelineGhl: testo(r.pipeline_ghl),
    }))
    .sort((a, b) => a.ordine - b.ordine);

export const creaCategoriaCommerciale: typeof Foglio.creaCategoriaCommerciale = async (input) => {
  if (await esiste("categorie_commerciali", "categoria_id", input.categoriaId)) {
    throw new Error(`Esiste già una categoria commerciale con id "${input.categoriaId}"`);
  }
  await inserisci("categorie_commerciali", [
    {
      categoria_id: input.categoriaId,
      sede_id: input.sedeId,
      nome: input.nome,
      tag_ghl: "",
      pipeline_ghl: "",
      attivo: true,
      ordine: intero(input.ordine),
      target_budget_mensile: input.targetBudgetMensile ?? null,
      target_lead_settimana: input.targetLeadSettimana ?? null,
      target_appuntamenti_settimana: input.targetAppuntamentiSettimana ?? null,
      target_fatturato_mensile: input.targetFatturatoMensile ?? null,
    },
  ]);
};

export const aggiornaCategoriaCommerciale: typeof Foglio.aggiornaCategoriaCommerciale = async (input) => {
  if (!(await esiste("categorie_commerciali", "categoria_id", input.categoriaId))) {
    throw new Error(`Categoria commerciale non trovata: ${input.categoriaId}`);
  }
  await aggiorna(
    "categorie_commerciali",
    { categoria_id: input.categoriaId },
    {
      nome: input.nome,
      tag_ghl: input.tagGhl,
      pipeline_ghl: input.pipelineGhl,
      attivo: input.attivo,
      ordine: input.ordine === undefined ? undefined : intero(input.ordine),
      target_budget_mensile: input.targetBudgetMensile,
      target_lead_settimana: input.targetLeadSettimana,
      target_appuntamenti_settimana: input.targetAppuntamentiSettimana,
      target_fatturato_mensile: input.targetFatturatoMensile,
    }
  );
};

export const eliminaCategoriaCommerciale: typeof Foglio.eliminaCategoriaCommerciale = (categoriaId) =>
  eliminaPerId("categorie_commerciali", "CategorieCommerciali", "categoria_id", categoriaId);

// ───────────────────────── Venditori ─────────────────────────

export const getVenditori: typeof Foglio.getVenditori = async () =>
  (await leggi("venditori")).map((r) => ({
    venditoreId: testo(r.venditore_id),
    sedeId: testo(r.sede_id),
    nome: testo(r.nome),
    capienzaAppuntamentiMensile: numero(r.capienza_appuntamenti_mensile),
    attivo: Boolean(r.attivo),
    ghlUserId: testo(r.ghl_user_id),
  }));

export const creaVenditore: typeof Foglio.creaVenditore = async (input) => {
  if (await esiste("venditori", "venditore_id", input.venditoreId)) {
    throw new Error(`Esiste già un venditore con id "${input.venditoreId}"`);
  }
  await inserisci("venditori", [
    {
      venditore_id: input.venditoreId,
      sede_id: input.sedeId,
      nome: input.nome,
      capienza_appuntamenti_mensile: input.capienzaAppuntamentiMensile,
      attivo: true,
      ghl_user_id: "",
    },
  ]);
};

export const aggiornaVenditore: typeof Foglio.aggiornaVenditore = async (input) => {
  if (!(await esiste("venditori", "venditore_id", input.venditoreId))) {
    throw new Error(`Venditore non trovato: ${input.venditoreId}`);
  }
  await aggiorna(
    "venditori",
    { venditore_id: input.venditoreId },
    { nome: input.nome, capienza_appuntamenti_mensile: input.capienzaAppuntamentiMensile, attivo: input.attivo, ghl_user_id: input.ghlUserId }
  );
};

export const eliminaVenditore: typeof Foglio.eliminaVenditore = (venditoreId) => eliminaPerId("venditori", "Venditori", "venditore_id", venditoreId);

export const getRisultatiVenditori: typeof Foglio.getRisultatiVenditori = async () =>
  (await leggi("risultati_venditori")).map((r) => ({
    mese: testo(r.mese),
    sedeId: testo(r.sede_id),
    venditoreId: testo(r.venditore_id),
    appuntamentiFissati: numero(r.appuntamenti_fissati),
    vendite: numero(r.vendite),
    fatturato: numero(r.fatturato),
  }));

// ───────────────────────── Connessioni ai canali pubblicitari ─────────────────────────

const canale = (v: unknown): Canale => (testo(v) === "google" ? "google" : "meta");

export const getConnessioniCanale: typeof Foglio.getConnessioniCanale = async () =>
  (await leggi("connessioni_canale")).map((r) => ({
    connessioneId: testo(r.connessione_id),
    sedeId: testo(r.sede_id),
    canale: canale(r.canale),
    accountId: testo(r.account_id),
    tipoConversioneLead: testo(r.tipo_conversione_lead),
    attivo: Boolean(r.attivo),
    note: testo(r.note),
    creataIl: testo(r.creata_il),
  }));

export const creaConnessioneCanale: typeof Foglio.creaConnessioneCanale = async (input) => {
  if (await esiste("connessioni_canale", "connessione_id", input.connessioneId)) {
    throw new Error(`Esiste già una connessione con id "${input.connessioneId}"`);
  }
  await inserisci("connessioni_canale", [
    {
      connessione_id: input.connessioneId,
      sede_id: input.sedeId,
      canale: input.canale,
      account_id: input.accountId,
      tipo_conversione_lead: input.tipoConversioneLead ?? "",
      attivo: true,
      note: input.note ?? "",
      creata_il: new Date().toISOString(),
    },
  ]);
};

export const aggiornaConnessioneCanale: typeof Foglio.aggiornaConnessioneCanale = async (input) => {
  if (!(await esiste("connessioni_canale", "connessione_id", input.connessioneId))) {
    throw new Error(`Connessione non trovata: ${input.connessioneId}`);
  }
  await aggiorna(
    "connessioni_canale",
    { connessione_id: input.connessioneId },
    { account_id: input.accountId, tipo_conversione_lead: input.tipoConversioneLead, attivo: input.attivo, note: input.note }
  );
};

export const eliminaConnessioneCanale: typeof Foglio.eliminaConnessioneCanale = (connessioneId) =>
  eliminaPerId("connessioni_canale", "ConnessioniCanale", "connessione_id", connessioneId);

export const migraConnessioniMeta: typeof Foglio.migraConnessioniMeta = async () => {
  const [sedi, connessioni] = await Promise.all([getSedi(), getConnessioniCanale()]);
  const esistenti = new Set(connessioni.map((c) => c.connessioneId));
  const oraIso = new Date().toISOString();
  const daCreare = sedi.filter((s) => s.adAccountId && !esistenti.has(`${s.sedeId}--meta`));
  await inserisci(
    "connessioni_canale",
    daCreare.map((sede) => ({
      connessione_id: `${sede.sedeId}--meta`,
      sede_id: sede.sedeId,
      canale: "meta",
      account_id: sede.adAccountId,
      tipo_conversione_lead: sede.tipoConversioneLead,
      attivo: true,
      note: "",
      creata_il: oraIso,
    }))
  );
  return { connessioniCreate: daCreare.map((s) => s.sedeId) };
};

/** Nel foglio creava una sede "Principale" dai vecchi campi della scheda Clienti e riempiva la sede
 * mancante su campagne e risultati. Nel database quei campi non esistono e ogni cliente nasce con
 * la sua sede: non c'è nulla da migrare. */
export const migraSediEsistenti: typeof Foglio.migraSediEsistenti = async () => ({
  sedeCreatePerCliente: [],
  campagneBackfillate: 0,
  risultatiCommercialiBackfillate: 0,
});

/** Nel foglio riscriveva in forma canonica gli assegnatari digitati a mano in una cella. Nel database
 * sono già un elenco: non c'è nulla da migrare. */
export const migraAssegnatariEsistenti: typeof Foglio.migraAssegnatariEsistenti = async () => ({ attivitaCliente: [], templateAttivita: [] });

// ───────────────────────── Persone e prodotti ─────────────────────────

// Consulenti e commerciali hanno la stessa forma in due tabelle diverse: qui i nomi che cambiano.
const SQUADRA = {
  consulente: { tabella: "consulenti", chiave: "consulente_id", nome: "consulente", Nome: "Consulente" },
  commerciale: { tabella: "commerciali", chiave: "commerciale_id", nome: "commerciale", Nome: "Commerciale" },
} as const;

/** Senza la password: questi oggetti arrivano fino al browser (vedi getCredenzialiAccesso). */
export const getConsulenti: typeof Foglio.getConsulenti = async () =>
  (await database().esegui("select consulente_id, nome, attivo, email from public.consulenti order by posizione")).map((r) => ({
    consulenteId: testo(r.consulente_id),
    nome: testo(r.nome),
    attivo: Boolean(r.attivo),
    email: testo(r.email),
  }));

export const getCommerciali: typeof Foglio.getCommerciali = async () =>
  (await database().esegui("select commerciale_id, nome, attivo, email from public.commerciali order by posizione")).map((r) => ({
    commercialeId: testo(r.commerciale_id),
    nome: testo(r.nome),
    attivo: Boolean(r.attivo),
    email: testo(r.email),
  }));

export const getCredenzialiAccesso: typeof Foglio.getCredenzialiAccesso = async () => {
  const leggiRuolo = async (ruolo: RuoloSquadra): Promise<CredenzialeAccesso[]> => {
    const t = SQUADRA[ruolo];
    const righe = await database().esegui(`select ${t.chiave} as id, attivo, password from public.${t.tabella} order by posizione`);
    return righe.map((r) => ({ ruolo, id: testo(r.id), attivo: Boolean(r.attivo), password: testo(r.password) }));
  };
  const [consulenti, commerciali] = await Promise.all([leggiRuolo("consulente"), leggiRuolo("commerciale")]);
  return [...consulenti, ...commerciali];
};

export const creaMembroSquadra: typeof Foglio.creaMembroSquadra = async (input) => {
  const t = SQUADRA[input.ruolo];
  if (await esiste(t.tabella, t.chiave, input.id)) {
    throw new Error(`Esiste già un ${t.nome} con id "${input.id}"`);
  }
  await inserisci(t.tabella, [{ [t.chiave]: input.id, nome: input.nome, password: input.password, attivo: true, email: input.email }]);
};

export const aggiornaMembroSquadra: typeof Foglio.aggiornaMembroSquadra = async (input) => {
  const t = SQUADRA[input.ruolo];
  await database().transazione(async (tx) => {
    const [attuale] = await tx.esegui<{ nome: string }>(`select nome from public.${t.tabella} where ${t.chiave} = $1`, [input.id]);
    if (!attuale) throw new Error(`${t.Nome} non trovato: ${input.id}`);
    await aggiorna(t.tabella, { [t.chiave]: input.id }, { nome: input.nome, email: input.email, attivo: input.attivo, password: input.password }, tx);
    if (input.ruolo === "consulente" && input.nome !== undefined && input.nome !== attuale.nome) {
      await rinominaAssegnatario(tx, input.id, attuale.nome, input.nome);
    }
  });
};

/**
 * Le attività ricordano chi le deve fare per nome, non per identificativo: se un consulente cambia
 * nome, il nuovo deve prendere il posto del vecchio, altrimenti le sue attività resterebbero
 * intestate a un nome che non c'è più (e sparirebbero dalle "sue" attività).
 *
 * Un'attività può portare il nome intero ("Eliano Ricci") o solo quello di battesimo ("Eliano"), che
 * l'app riconosce lo stesso (nomeCoincideConConsulente in src/lib/assegnatari.ts): si aggiornano
 * tutti e due. Il solo nome di battesimo però si tocca soltanto se è cambiato e se nessun altro
 * consulente lo porta: con due "Marco" non si saprebbe di chi sono le attività intestate a "Marco".
 */
async function rinominaAssegnatario(tx: Sessione, consulenteId: string, vecchio: string, nuovo: string): Promise<void> {
  const battesimo = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";
  const sostituzioni: [string, string][] = [[vecchio.trim(), nuovo.trim()]];
  const [prima, dopo] = [battesimo(vecchio), battesimo(nuovo)];
  if (prima && dopo && prima.toLowerCase() !== dopo.toLowerCase()) {
    const omonimi = await tx.esegui("select 1 as ok from public.consulenti where consulente_id <> $1 and lower(split_part(btrim(nome), ' ', 1)) = lower($2) limit 1", [consulenteId, prima]);
    if (omonimi.length === 0) sostituzioni.push([prima, dopo]);
  }
  for (const [da, a] of sostituzioni) {
    if (!da || da.toLowerCase() === a.toLowerCase()) continue;
    for (const tabellaAttivita of ["attivita_cliente", "template_attivita"]) {
      await tx.esegui(
        `update public.${tabellaAttivita} set assegnatari = (
           select array_agg(case when lower(btrim(u.a)) = lower($1::text) then $2::text else u.a end order by u.n)
           from unnest(assegnatari) with ordinality as u(a, n)
         )
         where exists (select 1 from unnest(assegnatari) as v(a) where lower(btrim(v.a)) = lower($1::text))`,
        [da, a]
      );
    }
  }
}

export const eliminaMembroSquadra: typeof Foglio.eliminaMembroSquadra = async (ruolo, id) => {
  const t = SQUADRA[ruolo];
  if ((await elimina(t.tabella, t.chiave, id)) === 0) throw new Error(`${t.Nome} non trovato: ${id}`);
};

export const getProdotti: typeof Foglio.getProdotti = async () =>
  (await leggi("prodotti")).map((r) => ({
    prodottoId: testo(r.prodotto_id),
    nome: testo(r.nome),
    attivo: Boolean(r.attivo),
    durataSettimane: numero(r.durata_settimane),
    note: testo(r.note),
  }));

export const creaProdotto: typeof Foglio.creaProdotto = async (input) => {
  if (await esiste("prodotti", "prodotto_id", input.prodottoId)) {
    throw new Error(`Esiste già un prodotto con id "${input.prodottoId}"`);
  }
  await inserisci("prodotti", [
    { prodotto_id: input.prodottoId, nome: input.nome, attivo: true, durata_settimane: intero(input.durataSettimane), note: input.note ?? "" },
  ]);
};

export const aggiornaProdotto: typeof Foglio.aggiornaProdotto = async (input) => {
  if (!(await esiste("prodotti", "prodotto_id", input.prodottoId))) {
    throw new Error(`Prodotto non trovato: ${input.prodottoId}`);
  }
  await aggiorna(
    "prodotti",
    { prodotto_id: input.prodottoId },
    {
      nome: input.nome,
      attivo: input.attivo,
      durata_settimane: input.durataSettimane === undefined ? undefined : intero(input.durataSettimane),
      note: input.note,
    }
  );
};

/** Il modello di attività del prodotto se ne va con lui (chiave esterna). */
export const eliminaProdotto: typeof Foglio.eliminaProdotto = async (prodottoId) => {
  if ((await elimina("prodotti", "prodotto_id", prodottoId)) === 0) throw new Error(`Prodotto non trovato: ${prodottoId}`);
};

export const getTemplateAttivita: typeof Foglio.getTemplateAttivita = async () =>
  (await leggi("template_attivita")).map((r) => ({
    prodottoId: testo(r.prodotto_id),
    taskId: testo(r.task_id),
    blocco: testo(r.blocco),
    fase: testo(r.fase),
    descrizione: testo(r.descrizione),
    assegnatari: assegnatari(r.assegnatari),
    tipo: testo(r.tipo),
    settimanaInizio: numero(r.settimana_inizio),
    settimanaFine: numero(r.settimana_fine),
    giorniTesto: testo(r.giorni_testo),
    nota: testo(r.nota),
    ordine: numero(r.ordine),
  }));

export const salvaTemplateTask: typeof Foglio.salvaTemplateTask = async (task) => {
  const chiave = { prodotto_id: task.prodottoId, task_id: task.taskId };
  const campi = {
    blocco: task.blocco,
    fase: task.fase,
    descrizione: task.descrizione,
    assegnatari: task.assegnatari,
    tipo: task.tipo,
    settimana_inizio: intero(task.settimanaInizio),
    settimana_fine: intero(task.settimanaFine),
    giorni_testo: task.giorniTesto,
    nota: task.nota,
    ordine: intero(task.ordine),
  };
  const giaPresente = await database().esegui("select 1 as ok from public.template_attivita where prodotto_id = $1 and task_id = $2", [task.prodottoId, task.taskId]);
  if (giaPresente.length > 0) {
    await aggiorna("template_attivita", chiave, campi);
    return { aggiornato: true };
  }
  await inserisci("template_attivita", [{ ...chiave, ...campi }]);
  return { aggiornato: false };
};

export const eliminaTemplateTask: typeof Foglio.eliminaTemplateTask = async (prodottoId, taskId) => {
  const esito = await database().esegui("delete from public.template_attivita where prodotto_id = $1 and task_id = $2 returning 1 as ok", [prodottoId, taskId]);
  if (esito.length === 0) throw new Error(`Riga non trovata in TemplateAttivita: ${prodottoId}/${taskId}`);
};

export const riordinaTemplateAttivita: typeof Foglio.riordinaTemplateAttivita = async (prodottoId, taskIdInOrdine) => {
  if (taskIdInOrdine.length === 0) return;
  await database().esegui(
    `update public.template_attivita as t set ordine = x.n::int
     from jsonb_array_elements_text($2::text::jsonb) with ordinality as x(task_id, n)
     where t.prodotto_id = $1 and t.task_id = x.task_id`,
    [prodottoId, JSON.stringify(taskIdInOrdine)]
  );
};

// ───────────────────────── Campagne e dati pubblicitari ─────────────────────────

export const getCampagne: typeof Foglio.getCampagne = async () =>
  (await leggi("campagne")).map((r) => ({
    campaignId: testo(r.campaign_id),
    clienteId: testo(r.cliente_id),
    nomeCampagna: testo(r.nome_campagna),
    tipoCampagna: testo(r.tipo_campagna),
    stato: testo(r.stato),
    sedeId: testo(r.sede_id),
    canale: canale(r.canale),
  }));

/** Tipo campagna dedotto dal prefisso fra parentesi quadre del nome ("[Prospecting] …"), saltando
 * l'etichetta "[ALC]" dell'agenzia. Stessa regola di guessTipoCampagnaFromNome in sheets.ts, che non
 * si può importare qui se non come tipo (porterebbe con sé il client di Google). */
function tipoCampagnaDalNome(nomeCampagna: string): string {
  let resto = nomeCampagna.trimStart();
  for (;;) {
    const match = resto.match(/^\[([^\]]+)\]/);
    const etichetta = match?.[1]?.trim();
    if (!match || !etichetta) return "";
    if (etichetta.toLowerCase() !== "alc") return etichetta.charAt(0).toUpperCase() + etichetta.slice(1).toLowerCase();
    resto = resto.slice(match[0].length).trimStart();
  }
}

export const ensureCampagneMappate: typeof Foglio.ensureCampagneMappate = async (candidate) => {
  await inserisci(
    "campagne",
    candidate.map((c) => ({
      canale: c.canale ?? "meta",
      campaign_id: c.campaignId,
      cliente_id: c.clienteId,
      sede_id: c.sedeId,
      nome_campagna: c.nomeCampagna,
      tipo_campagna: tipoCampagnaDalNome(c.nomeCampagna),
      stato: "",
    })),
    "on conflict (canale, campaign_id) do nothing"
  );
};

export const spostaCampagneASede: typeof Foglio.spostaCampagneASede = async (clienteId, campaignIds, sedeId) => {
  if (campaignIds.length === 0) return 0;
  const esito = await database().esegui(
    `update public.campagne set sede_id = $2
     where cliente_id = $1 and canale = 'meta' and sede_id <> $2
       and campaign_id in (select jsonb_array_elements_text($3::text::jsonb))
     returning 1 as ok`,
    [clienteId, sedeId, JSON.stringify(campaignIds)]
  );
  return esito.length;
};

export const aggiornaStatoCampagne: typeof Foglio.aggiornaStatoCampagne = async (statiPerCampagna) => {
  if (statiPerCampagna.size === 0) return;
  const oraIso = new Date().toISOString();
  await database().transazione(async (tx) => {
    const attuali = await leggi("campagne", "campaign_id in (select jsonb_array_elements_text($1::text::jsonb))", [JSON.stringify([...statiPerCampagna.keys()])], tx);
    const cambiate = attuali.filter((c) => statiPerCampagna.get(testo(c.campaign_id)) !== testo(c.stato));
    if (cambiate.length === 0) return;
    await tx.esegui(
      `update public.campagne as t set stato = x.stato
       from jsonb_to_recordset($1::text::jsonb) as x(canale text, campaign_id text, stato text)
       where t.canale = x.canale and t.campaign_id = x.campaign_id`,
      [JSON.stringify(cambiate.map((c) => ({ canale: c.canale, campaign_id: c.campaign_id, stato: statiPerCampagna.get(testo(c.campaign_id)) })))]
    );
    await inserisci(
      "storico_stato_campagne",
      cambiate.map((c) => ({
        cambiato_il: oraIso,
        campaign_id: c.campaign_id,
        cliente_id: c.cliente_id,
        nome_campagna: c.nome_campagna,
        stato_precedente: c.stato,
        stato_nuovo: statiPerCampagna.get(testo(c.campaign_id)),
      })),
      "",
      tx
    );
  });
};

export const getStoricoStatoCampagne: typeof Foglio.getStoricoStatoCampagne = async () =>
  (await leggi("storico_stato_campagne")).map((r) => ({
    cambiatoIl: testo(r.cambiato_il),
    campaignId: testo(r.campaign_id),
    clienteId: testo(r.cliente_id),
    nomeCampagna: testo(r.nome_campagna),
    statoPrecedente: testo(r.stato_precedente),
    statoNuovo: testo(r.stato_nuovo),
  }));

export const getUltimoCambioPerCampagna: typeof Foglio.getUltimoCambioPerCampagna = async () => {
  const righe = await database().esegui<{ campaign_id: string; ultimo: string }>(
    `select campaign_id, to_char(max(cambiato_il) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ultimo
     from public.storico_stato_campagne group by campaign_id`
  );
  return new Map(righe.map((r) => [r.campaign_id, r.ultimo]));
};

export const getMetaDaily: typeof Foglio.getMetaDaily = async () =>
  (await leggi("meta_daily")).map((r) => ({
    data: testo(r.data),
    clienteId: testo(r.cliente_id),
    campaignId: testo(r.campaign_id),
    spesa: numero(r.spesa),
    impressions: numero(r.impressions),
    clicks: numero(r.clicks),
    ctr: numero(r.ctr),
    cpc: numero(r.cpc),
    cpm: numero(r.cpm),
    lead: numero(r.lead),
    clicLink: numero(r.clic_link),
    canale: canale(r.canale),
  }));

export const upsertMetaDailyRows: typeof Foglio.upsertMetaDailyRows = async (rows) => {
  // Due righe con la stessa chiave nello stesso lotto: vale l'ultima (un `on conflict` non può
  // toccare due volte la stessa riga nella stessa istruzione).
  const perChiave = new Map<string, RigaTabella>();
  for (const r of rows) {
    const c = r.canale ?? "meta";
    perChiave.set(`${c}|${r.clienteId}|${r.campaignId}|${r.data}`, {
      canale: c,
      cliente_id: r.clienteId,
      campaign_id: r.campaignId,
      data: r.data,
      spesa: r.spesa,
      impressions: intero(r.impressions),
      clicks: intero(r.clicks),
      ctr: r.ctr,
      cpc: r.cpc,
      cpm: r.cpm,
      lead: r.lead,
      clic_link: intero(r.clicLink),
    });
  }
  await inserisci(
    "meta_daily",
    [...perChiave.values()],
    `on conflict (canale, cliente_id, campaign_id, data) do update set
       spesa = excluded.spesa, impressions = excluded.impressions, clicks = excluded.clicks, ctr = excluded.ctr,
       cpc = excluded.cpc, cpm = excluded.cpm, lead = excluded.lead, clic_link = excluded.clic_link`
  );
};

export const getRisultatiCommerciali: typeof Foglio.getRisultatiCommerciali = async () =>
  (await leggi("risultati_commerciali")).map((r) => ({
    periodo: testo(r.periodo),
    clienteId: testo(r.cliente_id),
    tipoCampagna: testo(r.tipo_campagna),
    richieste: numero(r.richieste),
    appuntamentiFissati: numero(r.appuntamenti_fissati),
    appuntamentiEffettuati: numero(r.appuntamenti_effettuati),
    vendite: numero(r.vendite),
    fatturato: numero(r.fatturato),
    sedeId: testo(r.sede_id),
  }));

/** Via le righe che la sede ha in quel periodo, dentro quelle nuove: tutto insieme o niente. */
export const salvaRisultatiCommerciali: typeof Foglio.salvaRisultatiCommerciali = async (input) => {
  await database().transazione(async (tx) => {
    await tx.esegui("delete from public.risultati_commerciali where cliente_id = $1 and sede_id = $2 and periodo = $3", [input.clienteId, input.sedeId, input.periodo]);
    await inserisci(
      "risultati_commerciali",
      input.righe.map((r) => ({
        periodo: input.periodo,
        cliente_id: input.clienteId,
        sede_id: input.sedeId,
        tipo_campagna: r.tipoCampagna,
        richieste: r.richieste,
        appuntamenti_fissati: r.appuntamentiFissati,
        appuntamenti_effettuati: r.appuntamentiEffettuati,
        vendite: r.vendite,
        fatturato: r.fatturato,
      })),
      "",
      tx
    );
  });
};

export const salvaRisultatiVenditori: typeof Foglio.salvaRisultatiVenditori = async (input) => {
  await database().transazione(async (tx) => {
    await tx.esegui("delete from public.risultati_venditori where sede_id = $1 and mese = $2", [input.sedeId, input.mese]);
    await inserisci(
      "risultati_venditori",
      input.righe.map((r) => ({
        mese: input.mese,
        sede_id: input.sedeId,
        venditore_id: r.venditoreId,
        appuntamenti_fissati: r.appuntamentiFissati,
        vendite: r.vendite,
        fatturato: r.fatturato,
      })),
      "",
      tx
    );
  });
};

// ───────────────────────── Attività e tappe ─────────────────────────

export const getAttivitaCliente: typeof Foglio.getAttivitaCliente = async () =>
  (await leggi("attivita_cliente")).map((r) => ({
    attivitaId: testo(r.attivita_id),
    clienteId: testo(r.cliente_id),
    prodottoId: testo(r.prodotto_id),
    taskId: testo(r.task_id),
    blocco: testo(r.blocco),
    fase: testo(r.fase),
    descrizione: testo(r.descrizione),
    assegnatari: assegnatari(r.assegnatari),
    tipo: testo(r.tipo),
    dataInizio: testo(r.data_inizio),
    dataFine: testo(r.data_fine),
    stato: (testo(r.stato) || "todo") as StatoAttivita,
    notaTeam: testo(r.nota_team),
    ordine: numero(r.ordine),
  }));

const rigaAttivita = (r: AttivitaClienteRow): RigaTabella => ({
  attivita_id: r.attivitaId,
  cliente_id: r.clienteId,
  prodotto_id: r.prodottoId,
  task_id: r.taskId,
  blocco: r.blocco,
  fase: r.fase,
  descrizione: r.descrizione,
  assegnatari: r.assegnatari,
  tipo: r.tipo,
  data_inizio: r.dataInizio,
  data_fine: r.dataFine,
  stato: r.stato,
  nota_team: r.notaTeam,
  ordine: intero(r.ordine),
});
// Un'attività che esiste già resta com'è (stessa regola del foglio: si aggiungono solo le nuove).
const SOLO_ATTIVITA_NUOVE = "on conflict (attivita_id) do nothing";

export const creaAttivitaPerCliente: typeof Foglio.creaAttivitaPerCliente = async (righe) => {
  await inserisci("attivita_cliente", righe.map(rigaAttivita), SOLO_ATTIVITA_NUOVE);
};

export const assegnaProdottoACliente: typeof Foglio.assegnaProdottoACliente = async (input) => {
  let attivitaCreate = 0;
  await database().transazione(async (tx) => {
    // Il cliente si rilegge qui dentro e resta fermo fino alla fine: due assegnazioni partite insieme
    // (due finestre aperte) non si scavalcano, la seconda trova il prodotto già scritto.
    const [riga] = await tx.esegui("select prodotto_id, data_inizio_progetto from public.clienti where cliente_id = $1 for update", [input.clienteId]);
    if (!riga) throw new Error(`Cliente non trovato: ${input.clienteId}`);
    const prodottoAttuale = testo(riga.prodotto_id);
    if (prodottoAttuale && (riga.data_inizio_progetto || prodottoAttuale !== input.prodottoId)) {
      throw new Error("Il cliente ha già un prodotto assegnato");
    }
    await aggiorna("clienti", { cliente_id: input.clienteId }, { prodotto_id: input.prodottoId, data_inizio_progetto: input.dataInizioProgetto }, tx);
    attivitaCreate = await inserisci("attivita_cliente", input.righe.map(rigaAttivita), SOLO_ATTIVITA_NUOVE, tx);
  });
  return { attivitaCreate };
};

async function aggiornaAttivita(attivitaId: string, campi: RigaTabella): Promise<void> {
  if ((await aggiorna("attivita_cliente", { attivita_id: attivitaId }, campi)) === 0) throw new Error(`Attività non trovata: ${attivitaId}`);
}

export const aggiornaStatoAttivita: typeof Foglio.aggiornaStatoAttivita = (attivitaId, nuovoStato, notaTeam) =>
  aggiornaAttivita(attivitaId, { stato: nuovoStato, nota_team: notaTeam });

export const aggiornaScadenzaAttivita: typeof Foglio.aggiornaScadenzaAttivita = (attivitaId, nuovaDataFine) =>
  aggiornaAttivita(attivitaId, { data_fine: nuovaDataFine });

export const aggiornaAssegnatariAttivita: typeof Foglio.aggiornaAssegnatariAttivita = (attivitaId, nuoviAssegnatari) =>
  aggiornaAttivita(attivitaId, { assegnatari: nuoviAssegnatari });

export const eliminaAttivita: typeof Foglio.eliminaAttivita = (attivitaId) => eliminaPerId("attivita_cliente", "AttivitaCliente", "attivita_id", attivitaId);

export const getFasiCompletate: typeof Foglio.getFasiCompletate = async () =>
  (await leggi("fasi_completate")).map((r) => ({ clienteId: testo(r.cliente_id), fase: testo(r.fase), completataIl: testo(r.completata_il) }));

export const registraFaseCompletata: typeof Foglio.registraFaseCompletata = async (clienteId, fase, completataIl) => {
  await inserisci("fasi_completate", [{ cliente_id: clienteId, fase, completata_il: completataIl }], "on conflict (cliente_id, fase) do nothing");
};

// ───────────────────────── Meeting ─────────────────────────

export const getMeetingCliente: typeof Foglio.getMeetingCliente = async () =>
  (await leggi("meeting_cliente")).map((r) => ({
    meetingId: testo(r.meeting_id),
    clienteId: testo(r.cliente_id),
    data: testo(r.data),
    titolo: testo(r.titolo),
    sentiment: testo(r.sentiment),
    aggiornatoIl: testo(r.aggiornato_il),
    dati: (r.dati && typeof r.dati === "object" ? r.dati : {}) as MeetingDataLoose,
  }));

export const salvaMeeting: typeof Foglio.salvaMeeting = async (record) => {
  const riga = {
    meeting_id: record.meetingId,
    cliente_id: record.clienteId,
    data: record.data,
    titolo: record.titolo,
    sentiment: record.sentiment,
    aggiornato_il: record.aggiornatoIl,
    dati: record.dati ?? {},
  };
  if (await esiste("meeting_cliente", "meeting_id", record.meetingId)) {
    const { meeting_id, ...campi } = riga;
    await aggiorna("meeting_cliente", { meeting_id }, campi);
    return { aggiornato: true };
  }
  await inserisci("meeting_cliente", [riga]);
  return { aggiornato: false };
};

/** Con il meeting se ne vanno le attività nate dai suoi "prossimi passi" (riconosciute dal taskId). */
export const eliminaMeeting: typeof Foglio.eliminaMeeting = async (meetingId) => {
  await database().transazione(async (tx) => {
    if ((await elimina("meeting_cliente", "meeting_id", meetingId, tx)) === 0) {
      throw new Error(`Riga non trovata in MeetingCliente: ${meetingId}`);
    }
    const attivita = await tx.esegui<{ attivita_id: string; task_id: string }>("select attivita_id, task_id from public.attivita_cliente");
    const daEliminare = attivita.filter((a) => estraiMeetingIdDaTaskId(a.task_id) === meetingId).map((a) => a.attivita_id);
    if (daEliminare.length > 0) {
      await tx.esegui("delete from public.attivita_cliente where attivita_id in (select jsonb_array_elements_text($1::text::jsonb))", [JSON.stringify(daEliminare)]);
    }
  });
};

// ───────────────────────── Prospect e report commerciali ─────────────────────────

export const getProspect: typeof Foglio.getProspect = async () =>
  (await leggi("prospect")).map((r) => ({
    prospectId: testo(r.prospect_id),
    ragioneSociale: testo(r.ragione_sociale),
    tipoBusiness: testo(r.tipo_business),
    fatturato: testo(r.fatturato),
    sedi: testo(r.sedi),
    email: testo(r.email),
    commercialeId: testo(r.commerciale_id),
    attivo: Boolean(r.attivo),
    creatoIl: testo(r.creato_il),
    driveFolderUrl: testo(r.drive_folder_url),
    mediaBudgetMensile: numeroONull(r.media_budget_mensile),
    targetCpl: numeroONull(r.target_cpl),
    targetCpaAppuntamento: numeroONull(r.target_cpa_appuntamento),
    targetLeadSettimana: numeroONull(r.target_lead_settimana),
    targetAppuntamentiSettimana: numeroONull(r.target_appuntamenti_settimana),
    targetFatturatoMensile: numeroONull(r.target_fatturato_mensile),
    targetMargineVenditaPct: numeroONull(r.target_margine_vendita_pct),
    clienteId: testo(r.cliente_id),
    consulenteSuggeritoId: testo(r.consulente_suggerito_id),
    calcolatoreBudget: (r.calcolatore_budget && typeof r.calcolatore_budget === "object" ? r.calcolatore_budget : null) as Prospect["calcolatoreBudget"],
    nomeContatto: testo(r.nome_contatto),
  }));

export const creaProspect: typeof Foglio.creaProspect = async (input) => {
  if (await esiste("prospect", "prospect_id", input.prospectId)) {
    throw new Error(`Esiste già un prospect con id "${input.prospectId}"`);
  }
  await inserisci("prospect", [
    {
      prospect_id: input.prospectId,
      ragione_sociale: input.ragioneSociale,
      nome_contatto: "",
      tipo_business: input.tipoBusiness ?? "",
      fatturato: input.fatturato ?? "",
      sedi: input.sedi ?? "",
      email: input.email ?? "",
      commerciale_id: input.commercialeId,
      attivo: true,
      creato_il: input.creatoIl || null,
      drive_folder_url: "",
      cliente_id: "",
      consulente_suggerito_id: "",
      calcolatore_budget: null,
    },
  ]);
};

export const aggiornaProspect: typeof Foglio.aggiornaProspect = async (input) => {
  if (!(await esiste("prospect", "prospect_id", input.prospectId))) {
    throw new Error(`Prospect non trovato: ${input.prospectId}`);
  }
  await aggiorna(
    "prospect",
    { prospect_id: input.prospectId },
    {
      ragione_sociale: input.ragioneSociale,
      tipo_business: input.tipoBusiness,
      fatturato: input.fatturato,
      sedi: input.sedi,
      email: input.email,
      attivo: input.attivo,
      drive_folder_url: input.driveFolderUrl,
      media_budget_mensile: input.mediaBudgetMensile,
      target_cpl: input.targetCpl,
      target_cpa_appuntamento: input.targetCpaAppuntamento,
      target_lead_settimana: input.targetLeadSettimana,
      target_appuntamenti_settimana: input.targetAppuntamentiSettimana,
      target_fatturato_mensile: input.targetFatturatoMensile,
      target_margine_vendita_pct: input.targetMargineVenditaPct,
      cliente_id: input.clienteId,
      consulente_suggerito_id: input.consulenteSuggeritoId,
      calcolatore_budget: input.calcolatoreBudget,
      nome_contatto: input.nomeContatto,
    }
  );
};

/** I report commerciali del prospect se ne vanno con lui (chiave esterna). */
export const eliminaProspect: typeof Foglio.eliminaProspect = async (prospectId) => {
  if ((await elimina("prospect", "prospect_id", prospectId)) === 0) throw new Error(`Prospect non trovato: ${prospectId}`);
};

export const getReportCommerciale: typeof Foglio.getReportCommerciale = async () =>
  (await leggi("report_commerciale")).map((r) => ({
    reportId: testo(r.report_id),
    prospectId: testo(r.prospect_id),
    commercialeId: testo(r.commerciale_id),
    data: testo(r.data),
    aggiornatoIl: testo(r.aggiornato_il),
    dati: (r.dati && typeof r.dati === "object" ? r.dati : {}) as ReportCommercialeDataLoose,
  }));

export const salvaReportCommerciale: typeof Foglio.salvaReportCommerciale = async (record) => {
  const riga = {
    report_id: record.reportId,
    prospect_id: record.prospectId,
    commerciale_id: record.commercialeId,
    data: record.data,
    aggiornato_il: record.aggiornatoIl,
    dati: record.dati ?? {},
  };
  if (await esiste("report_commerciale", "report_id", record.reportId)) {
    const { report_id, ...campi } = riga;
    await aggiorna("report_commerciale", { report_id }, campi);
    return { aggiornato: true };
  }
  await inserisci("report_commerciale", [riga]);
  return { aggiornato: false };
};
