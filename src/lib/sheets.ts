import { google } from "googleapis";
import { generaSedeId } from "@/lib/accessCode";
import { getGoogleOAuth2Client } from "@/lib/googleAuth";
import type {
  AttivitaClienteRow,
  Campagna,
  Cliente,
  Consulente,
  FunnelRow,
  MetaDailyRow,
  Prodotto,
  Sede,
  StatoAttivita,
  TemplateTask,
} from "@/types/kpi";
import type { MeetingClienteRow, MeetingDataLoose } from "@/types/meeting";
import type { Commerciale, Prospect, ReportCommercialeDataLoose, ReportCommercialeRow } from "@/types/prospect";
import type { GhlConnessione } from "@/types/ghl";

const TAB = {
  clienti: "Clienti",
  sedi: "Sedi",
  campagne: "Campagne",
  metaDaily: "MetaDaily",
  funnel: "Funnel",
  consulenti: "Consulenti",
  storicoStato: "StoricoStatoCampagne",
  prodotti: "Prodotti",
  templateAttivita: "TemplateAttivita",
  attivitaCliente: "AttivitaCliente",
  meetingCliente: "MeetingCliente",
  commerciali: "Commerciali",
  prospect: "Prospect",
  reportCommerciale: "ReportCommerciale",
  ghlConnessioni: "GhlConnessioni",
} as const;

// Client riusato tra le chiamate (nella stessa istanza serverless "calda"): evita di rifare
// lo scambio refresh_token -> access_token ad ogni singola lettura/scrittura.
// Separato da SHEET_ID (a differenza di prima) perché lo stesso account OAuth2 serve anche per
// scrivere sul foglio esterno "Report Operatività Clienti" (spreadsheet diverso, vedi
// appendReportOperativita) — un solo client, riusabile su qualunque spreadsheetId.
let sheetsCache: ReturnType<typeof google.sheets> | null = null;

function getAuth() {
  if (sheetsCache) return sheetsCache;
  sheetsCache = google.sheets({ version: "v4", auth: getGoogleOAuth2Client() });
  return sheetsCache;
}

function getSheetsClient() {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) {
    throw new Error("Google Sheets non configurato: manca SHEET_ID");
  }
  return { sheets: getAuth(), sheetId };
}

/**
 * Scrive una riga sul foglio esterno "Report Operatività Clienti | CLIENTI ANDREA LENZI
 * CONSULTING" — spreadsheet SEPARATO da SHEET_ID, usato dal team per altri scopi operativi.
 * Stesso account OAuth2 sopra (accesso diretto già verificato), nessun webhook Apps Script.
 * Sola scrittura: questo sheet non viene mai riletto dall'app, quindi nessuna cache da invalidare.
 */
export async function appendReportOperativita(row: (string | number)[]): Promise<void> {
  const spreadsheetId = process.env.REPORT_OPERATIVITA_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error("REPORT_OPERATIVITA_SHEET_ID non configurato");
  }
  const tab = process.env.REPORT_OPERATIVITA_TAB_NAME || "Risposte del modulo 1";
  await getAuth().spreadsheets.values.append({
    spreadsheetId,
    range: `'${tab}'!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export type CellValue = string | number | boolean | undefined | null;

// Cache breve in memoria per evitare di rileggere l'intera tab ad ogni richiesta quando i dati
// non sono cambiati (es. cambio range di date, più utenti che guardano la dashboard). Vive solo
// nell'istanza serverless "calda" corrente — nessuna condivisione tra istanze, va bene così: è
// un'ottimizzazione best-effort, non una fonte di verità.
const READ_CACHE_TTL_MS = 30_000;
const readCache = new Map<string, { data: CellValue[][]; scadenza: number }>();

function invalidateTabCache(tabName: string) {
  readCache.delete(tabName);
}

// `noCache`: per le tabelle dove un flusso crea-poi-rileggi-subito è normale (Prospect,
// ReportCommerciale, Commerciali — crei un prospect e vieni portato dritto sulla sua pagina) i 30s
// di cache best-effort sopra diventano un bug visibile invece di un'ottimizzazione invisibile: se
// la richiesta di creazione e quella di rilettura finiscono su istanze serverless diverse,
// l'invalidazione della prima non raggiunge la cache della seconda, che mostra dati vecchi di prima
// della creazione — bug osservato: prospect appena creato "non trovato", rimando alla lista.
async function readTab(tabName: string, opts?: { noCache?: boolean }): Promise<CellValue[][]> {
  if (!opts?.noCache) {
    const cached = readCache.get(tabName);
    if (cached && cached.scadenza > Date.now()) return cached.data;
  }

  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!A2:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const data = (res.data.values as CellValue[][]) ?? [];
  if (opts?.noCache) {
    readCache.delete(tabName); // non lasciare in giro una voce di cache stantia per letture future altrove
  } else {
    readCache.set(tabName, { data, scadenza: Date.now() + READ_CACHE_TTL_MS });
  }
  return data;
}

// Con UNFORMATTED_VALUE, Google Sheets rappresenta le date/i mesi che ha riconosciuto come
// tali (anche testo che scriviamo noi via USER_ENTERED, es. "2026-07-24") con un numero
// seriale (giorni dal 30/12/1899), non con la stringa originale. Va sempre riconvertito.
const SHEETS_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

export function serialToIsoDate(serial: number): string {
  return new Date(SHEETS_EPOCH_UTC_MS + Math.round(serial) * 86400000).toISOString().slice(0, 10);
}

function asText(value: CellValue): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

/**
 * Numero di riga (1-based, riga 1 = header) della prima riga la cui colonna A combacia con `id`,
 * o null. Pattern comune a Clienti/AttivitaCliente/MeetingCliente — prima triplicato quasi alla
 * lettera in tre punti diversi, ora un'unica implementazione.
 */
function trovaIndiceRiga(rows: CellValue[][], id: string): number | null {
  const i = rows.findIndex((r) => asText(r[0]) === id);
  return i === -1 ? null : i + 2;
}

/** Normalizza una cella "data" (YYYY-MM-DD) che Sheets potrebbe aver convertito in numero seriale. */
export function normalizeData(value: CellValue): string {
  if (typeof value === "number") return serialToIsoDate(value);
  return asText(value);
}

/** Normalizza una cella "mese" (YYYY-MM) che Sheets potrebbe aver convertito in numero seriale o data completa. */
export function normalizeMese(value: CellValue): string {
  if (typeof value === "number") return serialToIsoDate(value).slice(0, 7);
  return asText(value).slice(0, 7);
}

async function appendRows(tabName: string, rows: (string | number)[][]) {
  if (rows.length === 0) return;
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
  invalidateTabCache(tabName);
}

export function toNumber(value: CellValue): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toNumberOrNull(value: CellValue): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Le colonne C (adAccountId), G/H (targetCpa/targetCpl) ed L (tipoConversioneLead) restano
// fisicamente sulla tab Clienti (niente shift su un foglio che il team guarda/modifica a mano) ma
// sono vestigiali: da quando esiste Sede, questi valori vivono lì (uno per sede, non per cliente).
export async function getClienti(): Promise<Cliente[]> {
  const rows = await readTab(TAB.clienti);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      clienteId: asText(r[0]),
      nome: asText(r[1]),
      accessCode: asText(r[3]),
      attivo: asText(r[4]).trim().toUpperCase() === "TRUE",
      consulenteId: asText(r[5]),
      mostraTabExtra: asText(r[8]).trim().toUpperCase() === "TRUE",
      prodottoId: asText(r[9]),
      dataInizioProgetto: normalizeData(r[10]) || null,
      email: asText(r[12]),
    }));
}

export type NuovoClienteInput = {
  clienteId: string;
  nome: string;
  accessCode: string;
  consulenteId: string;
  mostraTabExtra: boolean;
  prodottoId: string;
  dataInizioProgetto: string | null;
  email?: string;
};

/** Crea un nuovo cliente (sempre attivo). Rifiuta esplicitamente un clienteId già in uso. */
export async function creaCliente(input: NuovoClienteInput): Promise<void> {
  const esistenti = await getClienti();
  if (esistenti.some((c) => c.clienteId === input.clienteId)) {
    throw new Error(`Esiste già un cliente con id "${input.clienteId}"`);
  }
  await appendRows(TAB.clienti, [
    [
      input.clienteId,
      input.nome,
      "", // colonna C, adAccountId — vestigiale, vedi Sede
      input.accessCode,
      "TRUE",
      input.consulenteId,
      "", // colonna G, targetCpa — vestigiale, vedi Sede
      "", // colonna H, targetCpl — vestigiale, vedi Sede
      input.mostraTabExtra ? "TRUE" : "FALSE",
      input.prodottoId,
      input.dataInizioProgetto ?? "",
      "", // colonna L, tipoConversioneLead — vestigiale, vedi Sede
      input.email ?? "",
    ],
  ]);
}

export type AggiornaClienteInput = {
  clienteId: string;
  nome?: string;
  consulenteId?: string;
  mostraTabExtra?: boolean;
  attivo?: boolean;
  email?: string;
};

/** Numero di riga (1-based, riga 1 = header) della prima riga con quel clienteId, o null. */
export function trovaIndiceRigaCliente(rows: CellValue[][], clienteId: string): number | null {
  return trovaIndiceRiga(rows, clienteId);
}

/**
 * Aggiorna solo i campi esplicitamente presenti in `input` (undefined = lascia invariato) di un
 * cliente esistente. Esclude deliberatamente prodottoId/dataInizioProgetto (colonne J/K, gestite
 * dal flusso roadmap dedicato) e accessCode (colonna D, mai riassegnabile da qui).
 */
export async function aggiornaCliente(input: AggiornaClienteInput): Promise<void> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.clienti}!A2:M`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rowNumber = trovaIndiceRigaCliente(righe, input.clienteId);
  if (rowNumber === null) {
    throw new Error(`Cliente non trovato: ${input.clienteId}`);
  }

  const data: { range: string; values: (string | number)[][] }[] = [];
  const set = (colonna: string, valore: string | number) =>
    data.push({ range: `${TAB.clienti}!${colonna}${rowNumber}`, values: [[valore]] });

  if (input.nome !== undefined) set("B", input.nome);
  if (input.attivo !== undefined) set("E", input.attivo ? "TRUE" : "FALSE");
  if (input.consulenteId !== undefined) set("F", input.consulenteId);
  if (input.mostraTabExtra !== undefined) set("I", input.mostraTabExtra ? "TRUE" : "FALSE");
  if (input.email !== undefined) set("M", input.email);

  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  invalidateTabCache(TAB.clienti);
}

// Tab Sedi, colonne A→H: sedeId, clienteId, nome, adAccountId, targetCpa, targetCpl,
// tipoConversioneLead, attivo. Un cliente ha sempre almeno una sede (vedi migraSediEsistenti).
export async function getSedi(): Promise<Sede[]> {
  const rows = await readTab(TAB.sedi);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      sedeId: asText(r[0]),
      clienteId: asText(r[1]),
      nome: asText(r[2]),
      adAccountId: asText(r[3]),
      targetCpa: toNumberOrNull(r[4]),
      targetCpl: toNumberOrNull(r[5]),
      tipoConversioneLead: asText(r[6]),
      attivo: asText(r[7]).trim().toUpperCase() === "TRUE",
    }));
}

export type NuovaSedeInput = {
  sedeId: string;
  clienteId: string;
  nome: string;
  adAccountId: string;
  targetCpa: number | null;
  targetCpl: number | null;
  tipoConversioneLead?: string;
};

/** Crea una nuova sede (sempre attiva). Rifiuta esplicitamente un sedeId già in uso. */
export async function creaSede(input: NuovaSedeInput): Promise<void> {
  const esistenti = await getSedi();
  if (esistenti.some((s) => s.sedeId === input.sedeId)) {
    throw new Error(`Esiste già una sede con id "${input.sedeId}"`);
  }
  await appendRows(TAB.sedi, [
    [
      input.sedeId,
      input.clienteId,
      input.nome,
      input.adAccountId,
      input.targetCpa ?? "",
      input.targetCpl ?? "",
      input.tipoConversioneLead ?? "",
      "TRUE",
    ],
  ]);
}

export type AggiornaSedeInput = {
  sedeId: string;
  nome?: string;
  adAccountId?: string;
  targetCpa?: number | null;
  targetCpl?: number | null;
  tipoConversioneLead?: string;
  attivo?: boolean;
};

/** Aggiorna solo i campi esplicitamente presenti in `input` (undefined = lascia invariato) di una sede esistente. */
export async function aggiornaSede(input: AggiornaSedeInput): Promise<void> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.sedi}!A2:H`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rowNumber = trovaIndiceRiga(righe, input.sedeId);
  if (rowNumber === null) {
    throw new Error(`Sede non trovata: ${input.sedeId}`);
  }

  const data: { range: string; values: (string | number)[][] }[] = [];
  const set = (colonna: string, valore: string | number) =>
    data.push({ range: `${TAB.sedi}!${colonna}${rowNumber}`, values: [[valore]] });

  if (input.nome !== undefined) set("C", input.nome);
  if (input.adAccountId !== undefined) set("D", input.adAccountId);
  if (input.targetCpa !== undefined) set("E", input.targetCpa ?? "");
  if (input.targetCpl !== undefined) set("F", input.targetCpl ?? "");
  if (input.tipoConversioneLead !== undefined) set("G", input.tipoConversioneLead);
  if (input.attivo !== undefined) set("H", input.attivo ? "TRUE" : "FALSE");

  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  invalidateTabCache(TAB.sedi);
}

// Tab GhlConnessioni, colonne A→H: connessioneId, sedeId, locationId, privateToken, attivo, note,
// creataIl, calendarIds (elenco separato da virgole — scelta esplicita dell'admin di quali
// calendari contare, vedi GhlConnessione in src/types/ghl.ts). Una per sede (non per cliente,
// stesso motivo di adAccountId su Sede). noCache: true come Prospect/ReportCommerciale/Commerciali
// — un flusso crea-poi-rileggi-subito (l'admin collega una sede da ModificaClienteModal e la lista
// si aggiorna subito) è normale qui, la cache di 30s diventerebbe un bug visibile tra istanze
// serverless diverse invece di un'ottimizzazione invisibile — vedi lo stesso bug già risolto per
// Prospect.
export async function getGhlConnessioni(): Promise<GhlConnessione[]> {
  const rows = await readTab(TAB.ghlConnessioni, { noCache: true });
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      connessioneId: asText(r[0]),
      sedeId: asText(r[1]),
      locationId: asText(r[2]),
      privateToken: asText(r[3]),
      attivo: asText(r[4]).trim().toUpperCase() === "TRUE",
      note: asText(r[5]),
      creataIl: asText(r[6]),
      calendarIds: asText(r[7])
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    }));
}

export type NuovaGhlConnessioneInput = {
  connessioneId: string;
  sedeId: string;
  locationId: string;
  privateToken: string;
  note?: string;
};

/** Crea una nuova connessione GHL (sempre attiva). Rifiuta esplicitamente un connessioneId già in uso. */
export async function creaGhlConnessione(input: NuovaGhlConnessioneInput): Promise<void> {
  const esistenti = await getGhlConnessioni();
  if (esistenti.some((c) => c.connessioneId === input.connessioneId)) {
    throw new Error(`Esiste già una connessione GHL con id "${input.connessioneId}"`);
  }
  await appendRows(TAB.ghlConnessioni, [
    [
      input.connessioneId,
      input.sedeId,
      input.locationId,
      input.privateToken,
      "TRUE",
      input.note ?? "",
      new Date().toISOString(),
    ],
  ]);
}

export type AggiornaGhlConnessioneInput = {
  connessioneId: string;
  locationId?: string;
  // undefined = lascia invariato il token esistente — il form non lo ri-mostra mai per intero,
  // quindi "campo vuoto" nel form NON deve tradursi in "sovrascrivi con stringa vuota" qui.
  privateToken?: string;
  attivo?: boolean;
  note?: string;
  // undefined = non toccare; [] è un valore esplicito valido (nessun calendario selezionato).
  calendarIds?: string[];
};

/** Aggiorna solo i campi esplicitamente presenti in `input` di una connessione GHL esistente. */
export async function aggiornaGhlConnessione(input: AggiornaGhlConnessioneInput): Promise<void> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.ghlConnessioni}!A2:H`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rowNumber = trovaIndiceRiga(righe, input.connessioneId);
  if (rowNumber === null) {
    throw new Error(`Connessione GHL non trovata: ${input.connessioneId}`);
  }

  const data: { range: string; values: (string | number)[][] }[] = [];
  const set = (colonna: string, valore: string | number) =>
    data.push({ range: `${TAB.ghlConnessioni}!${colonna}${rowNumber}`, values: [[valore]] });

  if (input.locationId !== undefined) set("C", input.locationId);
  if (input.privateToken !== undefined) set("D", input.privateToken);
  if (input.attivo !== undefined) set("E", input.attivo ? "TRUE" : "FALSE");
  if (input.note !== undefined) set("F", input.note);
  if (input.calendarIds !== undefined) set("H", input.calendarIds.join(","));

  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  invalidateTabCache(TAB.ghlConnessioni);
}

export type RisultatoMigrazioneSedi = {
  sedeCreatePerCliente: string[]; // clienteId per cui è stata creata una sede "Principale"
  campagneBackfillate: number;
  funnelBackfillate: number;
};

/**
 * Migrazione una tantum, idempotente: per ogni cliente che non ha ancora nessuna sede, crea una
 * sede "Principale" con i valori ancora presenti (vestigiali) sulle colonne C/G/H/L di Clienti,
 * poi backfilla sedeId sulle righe di Campagne/Funnel di quel cliente che ne sono ancora prive.
 * Sicura da rilanciare: salta i clienti che hanno già almeno una sede e le righe già backfillate.
 */
export async function migraSediEsistenti(): Promise<RisultatoMigrazioneSedi> {
  const { sheets, sheetId } = getSheetsClient();

  const [clientiRighe, sediEsistenti] = await Promise.all([readTab(TAB.clienti), getSedi()]);
  const clientiConSede = new Set(sediEsistenti.map((s) => s.clienteId));
  const sedeIdEsistenti = new Set(sediEsistenti.map((s) => s.sedeId));
  const sedePerCliente = new Map<string, string>();
  for (const s of sediEsistenti) {
    if (!sedePerCliente.has(s.clienteId)) sedePerCliente.set(s.clienteId, s.sedeId);
  }

  const nuoveSedi: (string | number)[][] = [];
  const sedeCreatePerCliente: string[] = [];
  for (const r of clientiRighe) {
    const clienteId = asText(r[0]);
    if (!clienteId || clientiConSede.has(clienteId)) continue;
    const nome = "Principale";
    const sedeId = generaSedeId(clienteId, nome, sedeIdEsistenti);
    sedeIdEsistenti.add(sedeId);
    sedePerCliente.set(clienteId, sedeId);
    nuoveSedi.push([sedeId, clienteId, nome, asText(r[2]), toNumberOrNull(r[6]) ?? "", toNumberOrNull(r[7]) ?? "", asText(r[11]), "TRUE"]);
    sedeCreatePerCliente.push(clienteId);
  }
  await appendRows(TAB.sedi, nuoveSedi);

  const campagneRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.campagne}!A2:F`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const campagneRighe = (campagneRes.data.values as CellValue[][]) ?? [];
  const campagneUpdate: { range: string; values: string[][] }[] = [];
  campagneRighe.forEach((r, i) => {
    if (!r[0] || asText(r[5])) return; // riga vuota o già backfillata
    const sedeId = sedePerCliente.get(asText(r[1]));
    if (!sedeId) return;
    campagneUpdate.push({ range: `${TAB.campagne}!F${i + 2}`, values: [[sedeId]] });
  });
  if (campagneUpdate.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: campagneUpdate },
    });
  }

  const funnelRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.funnel}!A2:I`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const funnelRighe = (funnelRes.data.values as CellValue[][]) ?? [];
  const funnelUpdate: { range: string; values: string[][] }[] = [];
  funnelRighe.forEach((r, i) => {
    if (!r[0] || asText(r[8])) return;
    const sedeId = sedePerCliente.get(asText(r[1]));
    if (!sedeId) return;
    funnelUpdate.push({ range: `${TAB.funnel}!I${i + 2}`, values: [[sedeId]] });
  });
  if (funnelUpdate.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: funnelUpdate },
    });
  }

  invalidateTabCache(TAB.sedi);
  invalidateTabCache(TAB.campagne);
  invalidateTabCache(TAB.funnel);

  return { sedeCreatePerCliente, campagneBackfillate: campagneUpdate.length, funnelBackfillate: funnelUpdate.length };
}

export async function getConsulenti(): Promise<Consulente[]> {
  const rows = await readTab(TAB.consulenti);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      consulenteId: asText(r[0]),
      nome: asText(r[1]),
      password: asText(r[2]),
      attivo: asText(r[3]).trim().toUpperCase() === "TRUE",
      email: asText(r[4]),
    }));
}

/** Stesso schema di Consulenti (consulenteId, nome, password, attivo, email) — ruolo "commerciale". */
export async function getCommerciali(): Promise<Commerciale[]> {
  const rows = await readTab(TAB.commerciali, { noCache: true });
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      commercialeId: asText(r[0]),
      nome: asText(r[1]),
      password: asText(r[2]),
      attivo: asText(r[3]).trim().toUpperCase() === "TRUE",
      email: asText(r[4]),
    }));
}

export async function getClienteByAccessCode(code: string): Promise<Cliente | null> {
  const clienti = await getClienti();
  return clienti.find((c) => c.accessCode === code) ?? null;
}

export async function getCampagne(): Promise<Campagna[]> {
  const rows = await readTab(TAB.campagne);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      campaignId: asText(r[0]),
      clienteId: asText(r[1]),
      nomeCampagna: asText(r[2]),
      tipoCampagna: asText(r[3]),
      stato: asText(r[4]),
      // Colonna F, aggiunta dopo le prime cinque per non spostare nulla di già scritto — vedi Sede.
      sedeId: asText(r[5]),
    }));
}

/**
 * Prova a dedurre il tipo_campagna dal prefisso tra parentesi quadre nel nome campagna
 * (convenzione di naming: "[Progetto] resto del nome"). Torna stringa vuota se non riconosce
 * il pattern, così la campagna resta "da classificare" a mano invece di prendere un valore sbagliato.
 */
export function guessTipoCampagnaFromNome(nomeCampagna: string): string {
  const match = nomeCampagna.match(/^\[([^\]]+)\]/);
  const testo = match?.[1]?.trim();
  if (!testo) return "";
  return testo.charAt(0).toUpperCase() + testo.slice(1).toLowerCase();
}

/**
 * Aggiunge alla tab Campagne tutte le campagne del lotto non ancora mappate, in un'unica scrittura
 * (una `append` invece di una per campagna nuova), deducendo tipo_campagna dal nome per ciascuna
 * (vuoto se il prefisso non è riconosciuto, resta "da classificare" a mano).
 */
export async function ensureCampagneMappate(
  candidate: { campaignId: string; clienteId: string; sedeId: string; nomeCampagna: string }[]
): Promise<void> {
  if (candidate.length === 0) return;
  const esistenti = await getCampagne();
  const idEsistenti = new Set(esistenti.map((c) => c.campaignId));

  const viste = new Set<string>();
  const righe: (string | number)[][] = [];
  for (const c of candidate) {
    if (idEsistenti.has(c.campaignId) || viste.has(c.campaignId)) continue;
    viste.add(c.campaignId);
    righe.push([c.campaignId, c.clienteId, c.nomeCampagna, guessTipoCampagnaFromNome(c.nomeCampagna), "", c.sedeId]);
  }
  await appendRows(TAB.campagne, righe);
}

/**
 * Aggiorna la colonna stato per le campagne presenti in `statiPerCampagna` (campaign_id -> stato Meta)
 * e registra ogni cambiamento rilevato nella tab StoricoStatoCampagne (una riga per transizione, non
 * per sync — se lo stato non cambia da un sync all'altro non si scrive nulla di nuovo). La prima volta
 * che una campagna viene sincronizzata, stato_precedente è vuoto: non è un vero "cambiamento", ma vale
 * comunque la pena registrarlo come prima rilevazione.
 */
export async function aggiornaStatoCampagne(statiPerCampagna: Map<string, string>): Promise<void> {
  if (statiPerCampagna.size === 0) return;
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.campagne}!A2:E`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];

  const data: { range: string; values: string[][] }[] = [];
  const cambiamenti: (string | number)[][] = [];
  const oraIso = new Date().toISOString();

  righe.forEach((r, i) => {
    const campaignId = asText(r[0]);
    const clienteId = asText(r[1]);
    const nomeCampagna = asText(r[2]);
    const statoAttuale = asText(r[4]);
    const nuovoStato = statiPerCampagna.get(campaignId);
    if (nuovoStato !== undefined && nuovoStato !== statoAttuale) {
      data.push({ range: `${TAB.campagne}!E${i + 2}`, values: [[nuovoStato]] });
      cambiamenti.push([oraIso, campaignId, clienteId, nomeCampagna, statoAttuale, nuovoStato]);
    }
  });
  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  invalidateTabCache(TAB.campagne);

  await appendRows(TAB.storicoStato, cambiamenti);
}

/** Riduce le righe (già lette) di StoricoStatoCampagne alla data/ora dell'ultimo cambio per ciascuna campagna. */
export function ultimoCambioDaRighe(rows: CellValue[][]): Map<string, string> {
  const ultimo = new Map<string, string>();
  for (const r of rows) {
    const campaignId = asText(r[1]);
    const dataOra = asText(r[0]);
    if (!campaignId || !dataOra) continue;
    const precedente = ultimo.get(campaignId);
    if (!precedente || dataOra > precedente) ultimo.set(campaignId, dataOra);
  }
  return ultimo;
}

/**
 * Data/ora (ISO) dell'ultimo cambio di stato rilevato per ciascuna campagna, per campaign_id.
 * È la data in cui il sync se n'è accorto (finestra rolling + cadenza del cron), non necessariamente
 * l'istante esatto in cui è stato cambiato su Meta Ads.
 */
export async function getUltimoCambioPerCampagna(): Promise<Map<string, string>> {
  const rows = await readTab(TAB.storicoStato);
  return ultimoCambioDaRighe(rows);
}

export async function getMetaDaily(): Promise<MetaDailyRow[]> {
  const rows = await readTab(TAB.metaDaily);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      data: normalizeData(r[0]),
      clienteId: asText(r[1]),
      campaignId: asText(r[2]),
      spesa: toNumber(r[3]),
      impressions: toNumber(r[4]),
      clicks: toNumber(r[5]),
      ctr: toNumber(r[6]),
      cpc: toNumber(r[7]),
      cpm: toNumber(r[8]),
      lead: toNumber(r[9]),
      // Colonna K: ha cambiato significato una volta ("clic unici in uscita" -> "clic sul link",
      // vedi extractClicLink in lib/meta.ts) — le righe scritte prima di ciascun cambio restano col
      // valore della metrica precedente finché non le rilegge un backfill una tantum, non
      // automaticamente. toNumber su una cella vuota (mai sincronizzata) torna 0 — dato mancante,
      // non un errore da segnalare.
      clicLink: toNumber(r[10]),
    }));
}

/**
 * Upsert per (clienteId, campaignId, data): aggiorna la riga se esiste, altrimenti la accoda.
 * Le righe da aggiornare vengono scritte con un'unica `batchUpdate` (una cella per posizione di
 * riga esistente) invece di una `update` HTTP separata per riga — con la finestra rolling che
 * rilegge giorni già scritti, la maggior parte delle righe di ogni sync sono update, non insert.
 */
export async function upsertMetaDailyRows(rows: MetaDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.metaDaily}!A2:C`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const esistenti = (res.data.values as CellValue[][]) ?? [];
  const indexByKey = new Map<string, number>();
  esistenti.forEach((r, i) => {
    indexByKey.set(`${asText(r[1])}|${asText(r[2])}|${normalizeData(r[0])}`, i + 2);
  });

  const daAggiornare: { range: string; values: (string | number)[][] }[] = [];
  const daAggiungere: (string | number)[][] = [];
  for (const row of rows) {
    const key = `${row.clienteId}|${row.campaignId}|${row.data}`;
    const rowValues = [
      row.data,
      row.clienteId,
      row.campaignId,
      row.spesa,
      row.impressions,
      row.clicks,
      row.ctr,
      row.cpc,
      row.cpm,
      row.lead,
      row.clicLink,
    ];
    const existingRowNumber = indexByKey.get(key);
    if (existingRowNumber) {
      daAggiornare.push({ range: `${TAB.metaDaily}!A${existingRowNumber}:K${existingRowNumber}`, values: [rowValues] });
    } else {
      daAggiungere.push(rowValues);
    }
  }

  if (daAggiornare.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: daAggiornare },
    });
    invalidateTabCache(TAB.metaDaily);
  }
  await appendRows(TAB.metaDaily, daAggiungere);
}

export async function getFunnel(): Promise<FunnelRow[]> {
  const rows = await readTab(TAB.funnel);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      mese: normalizeMese(r[0]),
      clienteId: asText(r[1]),
      tipoCampagna: asText(r[2]),
      richieste: toNumber(r[3]),
      appuntamentiFissati: toNumber(r[4]),
      appuntamentiEffettuati: toNumber(r[5]),
      vendite: toNumber(r[6]),
      fatturato: toNumber(r[7]),
      // Colonna I, aggiunta dopo le prime otto per non spostare nulla di già scritto — vedi Sede.
      // Inserita a mano insieme al resto della riga, non derivabile da nient'altro.
      sedeId: asText(r[8]),
    }));
}

export async function getProdotti(): Promise<Prodotto[]> {
  const rows = await readTab(TAB.prodotti);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      prodottoId: asText(r[0]),
      nome: asText(r[1]),
      attivo: asText(r[2]).trim().toUpperCase() === "TRUE",
      durataSettimane: toNumber(r[3]),
      note: asText(r[4]),
    }));
}

/** Template di roadmap per prodotto — solo lettura, mai scritta dall'app (editabile a mano per aggiungere prodotti). */
export async function getTemplateAttivita(): Promise<TemplateTask[]> {
  const rows = await readTab(TAB.templateAttivita);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      prodottoId: asText(r[0]),
      taskId: asText(r[1]),
      blocco: asText(r[2]),
      fase: asText(r[3]),
      descrizione: asText(r[4]),
      responsabile: asText(r[5]),
      tipo: asText(r[6]),
      settimanaInizio: toNumber(r[7]),
      settimanaFine: toNumber(r[8]),
      giorniTesto: asText(r[9]),
      nota: asText(r[10]),
      ordine: toNumber(r[11]),
    }));
}

export async function getAttivitaCliente(): Promise<AttivitaClienteRow[]> {
  const rows = await readTab(TAB.attivitaCliente);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      attivitaId: asText(r[0]),
      clienteId: asText(r[1]),
      prodottoId: asText(r[2]),
      taskId: asText(r[3]),
      blocco: asText(r[4]),
      fase: asText(r[5]),
      descrizione: asText(r[6]),
      responsabile: asText(r[7]),
      tipo: asText(r[8]),
      dataInizio: normalizeData(r[9]),
      dataFine: normalizeData(r[10]),
      stato: (asText(r[11]) || "todo") as StatoAttivita,
      notaTeam: asText(r[12]),
      ordine: toNumber(r[13]),
    }));
}

/**
 * Scrive le righe di roadmap generate per un cliente, in un'unica `append`, ignorando quelle
 * il cui attivitaId esiste già — idempotente per costruzione (stesso schema di `ensureCampagneMappate`),
 * sicura da richiamare in retry dopo un fallimento parziale.
 */
export async function creaAttivitaPerCliente(righe: AttivitaClienteRow[]): Promise<void> {
  if (righe.length === 0) return;
  const esistenti = await getAttivitaCliente();
  const idEsistenti = new Set(esistenti.map((a) => a.attivitaId));
  const daAggiungere = righe.filter((r) => !idEsistenti.has(r.attivitaId));
  if (daAggiungere.length === 0) return;

  await appendRows(
    TAB.attivitaCliente,
    daAggiungere.map((r) => [
      r.attivitaId,
      r.clienteId,
      r.prodottoId,
      r.taskId,
      r.blocco,
      r.fase,
      r.descrizione,
      r.responsabile,
      r.tipo,
      r.dataInizio,
      r.dataFine,
      r.stato,
      r.notaTeam,
      r.ordine,
    ])
  );
}

/** Numero di riga (1-based come nel foglio, riga 1 = header) della prima riga con quell'attivitaId, o null. */
export function trovaIndiceRigaAttivita(rows: CellValue[][], attivitaId: string): number | null {
  return trovaIndiceRiga(rows, attivitaId);
}

/**
 * Aggiorna stato (ed eventualmente nota) di una singola attività. `notaTeam` scritta solo se
 * esplicitamente passata: passare `undefined` lascia la nota esistente invariata (es. un normale
 * avanzamento todo->wip->done non deve cancellare una nota già presente).
 */
export async function aggiornaStatoAttivita(
  attivitaId: string,
  nuovoStato: StatoAttivita,
  notaTeam?: string
): Promise<void> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.attivitaCliente}!A2:N`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rowNumber = trovaIndiceRigaAttivita(righe, attivitaId);
  if (rowNumber === null) {
    throw new Error(`Attività non trovata: ${attivitaId}`);
  }

  const data: { range: string; values: string[][] }[] = [
    { range: `${TAB.attivitaCliente}!L${rowNumber}`, values: [[nuovoStato]] },
  ];
  if (notaTeam !== undefined) {
    data.push({ range: `${TAB.attivitaCliente}!M${rowNumber}`, values: [[notaTeam]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  invalidateTabCache(TAB.attivitaCliente);
}

/** Aggiorna solo la data di scadenza (colonna K, dataFine) di una singola attività. */
export async function aggiornaScadenzaAttivita(attivitaId: string, nuovaDataFine: string): Promise<void> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.attivitaCliente}!A2:N`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rowNumber = trovaIndiceRigaAttivita(righe, attivitaId);
  if (rowNumber === null) {
    throw new Error(`Attività non trovata: ${attivitaId}`);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${TAB.attivitaCliente}!K${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[nuovaDataFine]] },
  });
  invalidateTabCache(TAB.attivitaCliente);
}

/** Elimina definitivamente una riga di attività (cancella la riga dal foglio, non un soft-delete). */
export async function eliminaAttivita(attivitaId: string): Promise<void> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.attivitaCliente}!A2:N`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rowNumber = trovaIndiceRigaAttivita(righe, attivitaId);
  if (rowNumber === null) {
    throw new Error(`Attività non trovata: ${attivitaId}`);
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetGid = meta.data.sheets?.find((s) => s.properties?.title === TAB.attivitaCliente)?.properties?.sheetId;
  if (sheetGid === undefined || sheetGid === null) {
    throw new Error(`Tab non trovata: ${TAB.attivitaCliente}`);
  }

  // rowNumber è già 1-based (numero di riga reale nel foglio); deleteDimension vuole indici
  // 0-based con endIndex esclusivo, quindi startIndex = rowNumber - 1.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        { deleteDimension: { range: { sheetId: sheetGid, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } } },
      ],
    },
  });
  invalidateTabCache(TAB.attivitaCliente);
}

export async function getMeetingCliente(): Promise<MeetingClienteRow[]> {
  const rows = await readTab(TAB.meetingCliente);
  return rows
    .filter((r) => r[0])
    .map((r) => {
      let dati: MeetingDataLoose = {};
      try {
        dati = JSON.parse(asText(r[6]) || "{}");
      } catch {
        dati = {};
      }
      return {
        meetingId: asText(r[0]),
        clienteId: asText(r[1]),
        data: normalizeData(r[2]),
        titolo: asText(r[3]),
        sentiment: asText(r[4]),
        aggiornatoIl: asText(r[5]),
        dati,
      };
    });
}

/**
 * Upsert per meetingId: se esiste già una riga con lo stesso id (stesso link salvato di nuovo,
 * eventualmente corretto in anteprima), la aggiorna sul posto invece di rifiutarla come duplicato —
 * così una correzione di battitura resta salvabile. I task già generati da un salvataggio precedente
 * NON si aggiornano retroattivamente (stesso spirito "snapshot" della roadmap prodotto).
 */
export async function salvaMeeting(record: MeetingClienteRow): Promise<{ aggiornato: boolean }> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.meetingCliente}!A2:G`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rigaValues: (string | number)[] = [
    record.meetingId,
    record.clienteId,
    record.data,
    record.titolo,
    record.sentiment,
    record.aggiornatoIl,
    JSON.stringify(record.dati),
  ];

  const rowNumber = trovaIndiceRiga(righe, record.meetingId);
  if (rowNumber === null) {
    await appendRows(TAB.meetingCliente, [rigaValues]);
    return { aggiornato: false };
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${TAB.meetingCliente}!A${rowNumber}:G${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rigaValues] },
  });
  invalidateTabCache(TAB.meetingCliente);
  return { aggiornato: true };
}

// Tab Prospect, colonne A→Q: prospectId, ragioneSociale, tipoBusiness, fatturato, sedi, email,
// commercialeId, attivo, creatoIl, driveFolderUrl, mediaBudgetMensile, targetCpl,
// targetCpaAppuntamento, targetLeadSettimana, targetAppuntamentiSettimana, targetFatturatoMensile,
// targetMargineVenditaPct — anagrafica persistente del prospect, vedi types/prospect.ts. Le colonne
// J→Q sono più recenti delle prime 9: righe create prima della loro introduzione le leggono vuote
// (toNumberOrNull(undefined) → null, asText(undefined) → ""), mai un crash.
export async function getProspect(): Promise<Prospect[]> {
  const rows = await readTab(TAB.prospect, { noCache: true });
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      prospectId: asText(r[0]),
      ragioneSociale: asText(r[1]),
      tipoBusiness: asText(r[2]),
      fatturato: asText(r[3]),
      sedi: asText(r[4]),
      email: asText(r[5]),
      commercialeId: asText(r[6]),
      attivo: asText(r[7]).trim().toUpperCase() === "TRUE",
      creatoIl: asText(r[8]),
      driveFolderUrl: asText(r[9]),
      mediaBudgetMensile: toNumberOrNull(r[10]),
      targetCpl: toNumberOrNull(r[11]),
      targetCpaAppuntamento: toNumberOrNull(r[12]),
      targetLeadSettimana: toNumberOrNull(r[13]),
      targetAppuntamentiSettimana: toNumberOrNull(r[14]),
      targetFatturatoMensile: toNumberOrNull(r[15]),
      targetMargineVenditaPct: toNumberOrNull(r[16]),
    }));
}

export type NuovoProspectInput = {
  prospectId: string;
  ragioneSociale: string;
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;
  email?: string;
  commercialeId: string;
  creatoIl: string;
};

/** Crea un nuovo prospect (sempre attivo). Rifiuta esplicitamente un prospectId già in uso. */
export async function creaProspect(input: NuovoProspectInput): Promise<void> {
  const esistenti = await getProspect();
  if (esistenti.some((p) => p.prospectId === input.prospectId)) {
    throw new Error(`Esiste già un prospect con id "${input.prospectId}"`);
  }
  await appendRows(TAB.prospect, [
    [
      input.prospectId,
      input.ragioneSociale,
      input.tipoBusiness ?? "",
      input.fatturato ?? "",
      input.sedi ?? "",
      input.email ?? "",
      input.commercialeId,
      "TRUE",
      input.creatoIl,
    ],
  ]);
}

export type AggiornaProspectInput = {
  prospectId: string;
  ragioneSociale?: string;
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;
  email?: string;
  attivo?: boolean;
  driveFolderUrl?: string;
  mediaBudgetMensile?: number | null;
  targetCpl?: number | null;
  targetCpaAppuntamento?: number | null;
  targetLeadSettimana?: number | null;
  targetAppuntamentiSettimana?: number | null;
  targetFatturatoMensile?: number | null;
  targetMargineVenditaPct?: number | null;
};

/**
 * Aggiorna solo i campi esplicitamente presenti in `input` (undefined = lascia invariato). Usata
 * sia dal modulo di gestione prospect (anagrafica + dati commerciali, vedi PATCH /api/prospect) sia
 * — per i 4 campi anagrafici soltanto — a ogni salvataggio di un report (vedi POST
 * /api/report-commerciale): tenerli allineati all'ultimo report evita di doverli re-inserire al
 * report successivo.
 */
export async function aggiornaProspect(input: AggiornaProspectInput): Promise<void> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.prospect}!A2:Q`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rowNumber = trovaIndiceRiga(righe, input.prospectId);
  if (rowNumber === null) {
    throw new Error(`Prospect non trovato: ${input.prospectId}`);
  }

  const data: { range: string; values: (string | number)[][] }[] = [];
  const set = (colonna: string, valore: string | number) =>
    data.push({ range: `${TAB.prospect}!${colonna}${rowNumber}`, values: [[valore]] });

  if (input.ragioneSociale !== undefined) set("B", input.ragioneSociale);
  if (input.tipoBusiness !== undefined) set("C", input.tipoBusiness);
  if (input.fatturato !== undefined) set("D", input.fatturato);
  if (input.sedi !== undefined) set("E", input.sedi);
  if (input.email !== undefined) set("F", input.email);
  if (input.attivo !== undefined) set("H", input.attivo ? "TRUE" : "FALSE");
  if (input.driveFolderUrl !== undefined) set("J", input.driveFolderUrl);
  if (input.mediaBudgetMensile !== undefined) set("K", input.mediaBudgetMensile ?? "");
  if (input.targetCpl !== undefined) set("L", input.targetCpl ?? "");
  if (input.targetCpaAppuntamento !== undefined) set("M", input.targetCpaAppuntamento ?? "");
  if (input.targetLeadSettimana !== undefined) set("N", input.targetLeadSettimana ?? "");
  if (input.targetAppuntamentiSettimana !== undefined) set("O", input.targetAppuntamentiSettimana ?? "");
  if (input.targetFatturatoMensile !== undefined) set("P", input.targetFatturatoMensile ?? "");
  if (input.targetMargineVenditaPct !== undefined) set("Q", input.targetMargineVenditaPct ?? "");

  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  invalidateTabCache(TAB.prospect);
}

// Tab ReportCommerciale, colonne A→F: reportId, prospectId, commercialeId, data, aggiornatoIl,
// dati (l'intero ReportCommercialeDataLoose JSON-stringificato) — stesso pattern di MeetingCliente.
export async function getReportCommerciale(): Promise<ReportCommercialeRow[]> {
  const rows = await readTab(TAB.reportCommerciale, { noCache: true });
  return rows
    .filter((r) => r[0])
    .map((r) => {
      let dati: ReportCommercialeDataLoose = {};
      try {
        dati = JSON.parse(asText(r[5]) || "{}");
      } catch {
        dati = {};
      }
      return {
        reportId: asText(r[0]),
        prospectId: asText(r[1]),
        commercialeId: asText(r[2]),
        data: normalizeData(r[3]),
        aggiornatoIl: asText(r[4]),
        dati,
      };
    });
}

/**
 * Upsert per reportId — stesso pattern di salvaMeeting: un salvataggio con lo stesso id (stesso
 * link, eventualmente ricorretto in anteprima) aggiorna sul posto invece di duplicare.
 */
export async function salvaReportCommerciale(record: ReportCommercialeRow): Promise<{ aggiornato: boolean }> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB.reportCommerciale}!A2:F`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const righe = (res.data.values as CellValue[][]) ?? [];
  const rigaValues: (string | number)[] = [
    record.reportId,
    record.prospectId,
    record.commercialeId,
    record.data,
    record.aggiornatoIl,
    JSON.stringify(record.dati),
  ];

  const rowNumber = trovaIndiceRiga(righe, record.reportId);
  if (rowNumber === null) {
    await appendRows(TAB.reportCommerciale, [rigaValues]);
    return { aggiornato: false };
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${TAB.reportCommerciale}!A${rowNumber}:F${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rigaValues] },
  });
  invalidateTabCache(TAB.reportCommerciale);
  return { aggiornato: true };
}
