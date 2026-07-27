import { google } from "googleapis";
import type { Campagna, Cliente, FunnelRow, MetaDailyRow } from "@/types/kpi";

const TAB = {
  clienti: "Clienti",
  campagne: "Campagne",
  metaDaily: "MetaDaily",
  funnel: "Funnel",
} as const;

function getSheetsClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const sheetId = process.env.SHEET_ID;

  if (!clientId || !clientSecret || !refreshToken || !sheetId) {
    throw new Error(
      "Google Sheets non configurato: mancano GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN / SHEET_ID"
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

type CellValue = string | number | boolean | undefined | null;

async function readTab(tabName: string): Promise<CellValue[][]> {
  const { sheets, sheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!A2:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (res.data.values as CellValue[][]) ?? [];
}

// Con UNFORMATTED_VALUE, Google Sheets rappresenta le date/i mesi che ha riconosciuto come
// tali (anche testo che scriviamo noi via USER_ENTERED, es. "2026-07-24") con un numero
// seriale (giorni dal 30/12/1899), non con la stringa originale. Va sempre riconvertito.
const SHEETS_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

function serialToIsoDate(serial: number): string {
  return new Date(SHEETS_EPOCH_UTC_MS + Math.round(serial) * 86400000).toISOString().slice(0, 10);
}

function asText(value: CellValue): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

/** Normalizza una cella "data" (YYYY-MM-DD) che Sheets potrebbe aver convertito in numero seriale. */
function normalizeData(value: CellValue): string {
  if (typeof value === "number") return serialToIsoDate(value);
  return asText(value);
}

/** Normalizza una cella "mese" (YYYY-MM) che Sheets potrebbe aver convertito in numero seriale o data completa. */
function normalizeMese(value: CellValue): string {
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
}

async function updateRow(tabName: string, rowNumber: number, row: (string | number)[]) {
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A${rowNumber}:Z${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

function toNumber(value: CellValue): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
    }));
}

/** Aggiunge la campagna alla tab Campagne se non è già mappata, con tipo_campagna vuoto da classificare a mano. */
export async function ensureCampagnaMapped(
  campaignId: string,
  clienteId: string,
  nomeCampagna: string
): Promise<void> {
  const esistenti = await getCampagne();
  if (esistenti.some((c) => c.campaignId === campaignId)) return;
  await appendRows(TAB.campagne, [[campaignId, clienteId, nomeCampagna, ""]]);
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

/** Upsert per (clienteId, campaignId, data): aggiorna la riga se esiste, altrimenti la accoda. */
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
      await updateRow(TAB.metaDaily, existingRowNumber, rowValues);
    } else {
      daAggiungere.push(rowValues);
    }
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
