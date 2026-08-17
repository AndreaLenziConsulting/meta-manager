import { google } from "googleapis";
import type {
  AttivitaClienteRow,
  Campagna,
  Cliente,
  Consulente,
  FunnelRow,
  MetaDailyRow,
  Prodotto,
  StatoAttivita,
  TemplateTask,
} from "@/types/kpi";
import type { MeetingClienteRow, MeetingDataLoose } from "@/types/meeting";

const TAB = {
  clienti: "Clienti",
  campagne: "Campagne",
  metaDaily: "MetaDaily",
  funnel: "Funnel",
  consulenti: "Consulenti",
  storicoStato: "StoricoStatoCampagne",
  prodotti: "Prodotti",
  templateAttivita: "TemplateAttivita",
  attivitaCliente: "AttivitaCliente",
  meetingCliente: "MeetingCliente",
} as const;

// Client riusato tra le chiamate (nella stessa istanza serverless "calda"): evita di rifare
// lo scambio refresh_token -> access_token ad ogni singola lettura/scrittura.
// Separato da SHEET_ID (a differenza di prima) perché lo stesso account OAuth2 serve anche per
// scrivere sul foglio esterno "Report Operatività Clienti" (spreadsheet diverso, vedi
// appendReportOperativita) — un solo client, riusabile su qualunque spreadsheetId.
let sheetsCache: ReturnType<typeof google.sheets> | null = null;

function getAuth() {
  if (sheetsCache) return sheetsCache;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth2 non configurato: mancano GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN"
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  sheetsCache = google.sheets({ version: "v4", auth });
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

async function readTab(tabName: string): Promise<CellValue[][]> {
  const cached = readCache.get(tabName);
  if (cached && cached.scadenza > Date.now()) return cached.data;

  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!A2:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const data = (res.data.values as CellValue[][]) ?? [];
  readCache.set(tabName, { data, scadenza: Date.now() + READ_CACHE_TTL_MS });
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

export async function getClienti(): Promise<Cliente[]> {
  const rows = await readTab(TAB.clienti);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      clienteId: asText(r[0]),
      nome: asText(r[1]),
      adAccountId: asText(r[2]),
      accessCode: asText(r[3]),
      attivo: asText(r[4]).trim().toUpperCase() === "TRUE",
      consulenteId: asText(r[5]),
      targetCpa: toNumberOrNull(r[6]),
      targetCpl: toNumberOrNull(r[7]),
      mostraTabExtra: asText(r[8]).trim().toUpperCase() === "TRUE",
      prodottoId: asText(r[9]),
      dataInizioProgetto: normalizeData(r[10]) || null,
    }));
}

export type NuovoClienteInput = {
  clienteId: string;
  nome: string;
  adAccountId: string;
  accessCode: string;
  consulenteId: string;
  targetCpa: number | null;
  targetCpl: number | null;
  mostraTabExtra: boolean;
  prodottoId: string;
  dataInizioProgetto: string | null;
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
      input.adAccountId,
      input.accessCode,
      "TRUE",
      input.consulenteId,
      input.targetCpa ?? "",
      input.targetCpl ?? "",
      input.mostraTabExtra ? "TRUE" : "FALSE",
      input.prodottoId,
      input.dataInizioProgetto ?? "",
    ],
  ]);
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
  candidate: { campaignId: string; clienteId: string; nomeCampagna: string }[]
): Promise<void> {
  if (candidate.length === 0) return;
  const esistenti = await getCampagne();
  const idEsistenti = new Set(esistenti.map((c) => c.campaignId));

  const viste = new Set<string>();
  const righe: (string | number)[][] = [];
  for (const c of candidate) {
    if (idEsistenti.has(c.campaignId) || viste.has(c.campaignId)) continue;
    viste.add(c.campaignId);
    righe.push([c.campaignId, c.clienteId, c.nomeCampagna, guessTipoCampagnaFromNome(c.nomeCampagna), ""]);
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
    ];
    const existingRowNumber = indexByKey.get(key);
    if (existingRowNumber) {
      daAggiornare.push({ range: `${TAB.metaDaily}!A${existingRowNumber}:J${existingRowNumber}`, values: [rowValues] });
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
  const i = rows.findIndex((r) => asText(r[0]) === attivitaId);
  return i === -1 ? null : i + 2;
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

  const indiceEsistente = righe.findIndex((r) => asText(r[0]) === record.meetingId);
  if (indiceEsistente === -1) {
    await appendRows(TAB.meetingCliente, [rigaValues]);
    return { aggiornato: false };
  }

  const rowNumber = indiceEsistente + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${TAB.meetingCliente}!A${rowNumber}:G${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rigaValues] },
  });
  invalidateTabCache(TAB.meetingCliente);
  return { aggiornato: true };
}
