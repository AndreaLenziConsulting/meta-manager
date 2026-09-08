import { google } from "googleapis";
import { getGoogleOAuth2Client } from "@/lib/googleAuth";
import { idCartellaDaUrl } from "@/lib/driveNomi";

/**
 * Get-or-create del "file di compilazione appuntamenti" dentro la cartella Drive di UN cliente
 * esistente (Cliente.driveFolderUrl) — dominio diverso da drive.ts, che è l'hand-off commerciale
 * dei PROSPECT dentro lo shared drive del team: qui la cartella è quella (arbitraria) che l'admin
 * ha collegato per un cliente già attivo, quindi separato in un proprio modulo invece di
 * confondere i due domini in drive.ts.
 *
 * Solo per sedi SENZA connessione GHL attiva (decisione esplicita dell'utente, 08/09/2026): un
 * cliente GHL-connesso ha gli appuntamenti letti in diretta, non ha senso chiedergli di
 * compilarli a mano. Il chiamante (src/app/api/clienti/file-appuntamenti/route.ts) applica quel
 * gate, non questo modulo — qui c'è solo la meccanica Drive/Sheets.
 *
 * Stesso account OAuth2 di sheets.ts/drive.ts (vedi googleAuth.ts): funziona SOLO se quell'account
 * ha già accesso in scrittura alla cartella puntata da driveFolderUrl — vero per ogni cartella che
 * l'admin ha creato o con cui è stato condiviso lui stesso (il caso comune), ma non verificabile
 * lato codice: un 403 qui significa che la cartella non è condivisa con l'account giusto.
 */

const MIME_SHEET = "application/vnd.google-apps.spreadsheet";
const INTESTAZIONI = ["Mese", "Richieste", "Appuntamenti fissati", "Appuntamenti effettuati", "Vendite", "Fatturato"];

let driveCache: ReturnType<typeof google.drive> | null = null;
let sheetsCache: ReturnType<typeof google.sheets> | null = null;

function getDrive() {
  if (!driveCache) driveCache = google.drive({ version: "v3", auth: getGoogleOAuth2Client() });
  return driveCache;
}

function getSheets() {
  if (!sheetsCache) sheetsCache = google.sheets({ version: "v4", auth: getGoogleOAuth2Client() });
  return sheetsCache;
}

function nomeFile(nomeCliente: string): string {
  return `Appuntamenti — ${nomeCliente.trim()}`;
}

/** Stesso escaping di drive.ts (Drive non ha un modo di escapare l'apice in `q` se non col backslash). */
function escapeQ(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function trovaFile(cartellaId: string, nome: string): Promise<string | null> {
  const res = await getDrive().files.list({
    q: `'${cartellaId}' in parents and name = '${escapeQ(nome)}' and mimeType = '${MIME_SHEET}' and trashed = false`,
    fields: "files(id)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

/**
 * Crea il file DIRETTAMENTE dentro la cartella (un solo `files.create`, non un create-poi-sposta:
 * a differenza di Sheets API `spreadsheets.create`, che lo metterebbe nella root di "My Drive"),
 * poi scrive intestazioni + un tocco di formattazione (grassetto, riga bloccata) via Sheets API
 * sullo stesso file id.
 */
async function creaFile(cartellaId: string, nome: string): Promise<string> {
  const res = await getDrive().files.create({
    requestBody: { name: nome, mimeType: MIME_SHEET, parents: [cartellaId] },
    fields: "id",
    supportsAllDrives: true,
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error(`Creazione del file "${nome}" non riuscita`);

  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: "A1:F1",
    valueInputOption: "RAW",
    requestBody: { values: [INTESTAZIONI] },
  });
  // Grassetto + riga bloccata sull'intestazione — un tocco di cura per un file che apre anche il
  // cliente, non solo il team interno. sheetId 0 = primo (unico) foglio di un file appena creato.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: fileId,
    requestBody: {
      requests: [
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
        { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
      ],
    },
  });

  return fileId;
}

/**
 * Get-or-create per nome (idempotente, mai un duplicato) del file di compilazione appuntamenti
 * dentro la cartella Drive del cliente. Il chiamante (route API) fa il fast-path: se
 * Cliente.appuntamentiFileUrl è già impostato, torna quello senza mai passare di qui.
 */
export async function trovaOCreaFileAppuntamenti(driveFolderUrl: string, nomeCliente: string): Promise<string> {
  const cartellaId = idCartellaDaUrl(driveFolderUrl);
  if (!cartellaId) {
    throw new Error("Il link Drive del cliente non punta a una cartella valida (formato .../drive/folders/<id>)");
  }
  const nome = nomeFile(nomeCliente);
  const fileId = (await trovaFile(cartellaId, nome)) ?? (await creaFile(cartellaId, nome));
  return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
}
