import { google } from "googleapis";
import { getGoogleOAuth2Client } from "@/lib/googleAuth";
import { idCartellaDaUrl } from "@/lib/driveNomi";
import { VOCI_STATO_CONTATTO } from "@/lib/foglioContatti";

/**
 * FORMATO DEL FILE (ridefinito il 01/10/2026, richiesta utente): non più una riga per mese con i
 * totali (Mese/Richieste/Appuntamenti/Vendite/Fatturato — nessun cliente l'ha mai compilato, e l'app
 * non lo leggeva), ma UNA RIGA PER CONTATTO con un menù a tendina "Stato" e una colonna "Fatturato",
 * lo stesso schema dei file "Contatti Acquisition Control" già in uso. È il file che
 * src/lib/foglioContatti.ts legge dal vivo per le sedi senza GHL. Chi ha già un file contatti
 * alimentato dai moduli Meta incolla il suo link in Modifica cliente; questo modello serve a chi
 * parte da zero e inserisce i contatti a mano.
 *
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
// L'ordine conta per foglioContatti.ts solo in un punto: "Fatturato" deve stare subito a destra di
// "Stato". Le altre colonne sono riconosciute dal nome dell'intestazione ("Data...", "ID campagna",
// "ID inserzione") — gli id sono facoltativi, servono ad attribuire il contatto alla campagna e
// all'inserzione nella tabella Dettaglio.
const INTESTAZIONI = ["Data contatto", "Nome", "Telefono", "Email", "ID campagna", "ID inserzione", "Stato", "Fatturato", "Note"];
const COLONNA_DATA = 0;
const COLONNA_STATO = INTESTAZIONI.indexOf("Stato");
const COLONNA_FATTURATO = INTESTAZIONI.indexOf("Fatturato");
// Righe di un foglio nuovo: tendina e formati vengono stesi su tutte, pronte per la compilazione.
const RIGHE_MODELLO = 1000;

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
 * Scrive sul primo foglio del file il modello "una riga per contatto": intestazioni (grassetto, riga
 * bloccata), menù a tendina dello stato, data e valuta già formattate. Esportata perché serve anche
 * a portare al formato nuovo i file creati col vecchio modello mensile e mai compilati (una tantum,
 * 01/10/2026) — non controlla cosa c'è nel foglio: il chiamante deve averlo verificato vuoto.
 */
export async function impostaModelloContatti(fileId: string): Promise<void> {
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: fileId, fields: "sheets(properties(sheetId))" });
  const sheetId = meta.data.sheets?.[0]?.properties?.sheetId ?? 0;
  const colonna = (indice: number) => ({ sheetId, startRowIndex: 1, endRowIndex: RIGHE_MODELLO, startColumnIndex: indice, endColumnIndex: indice + 1 });

  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: "A1:I1",
    valueInputOption: "RAW",
    requestBody: { values: [INTESTAZIONI] },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: fileId,
    requestBody: {
      requests: [
        // Grassetto + riga bloccata sull'intestazione — un tocco di cura per un file che apre anche
        // il cliente, non solo il team interno.
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
        // Menù a tendina dello stato: le stesse voci che foglioContatti.ts sa leggere. Non "strict":
        // un testo libero resta possibile (conta come contatto, mai come appuntamento o vendita).
        {
          setDataValidation: {
            range: colonna(COLONNA_STATO),
            rule: {
              condition: { type: "ONE_OF_LIST", values: VOCI_STATO_CONTATTO.map((voce) => ({ userEnteredValue: voce })) },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        { repeatCell: { range: colonna(COLONNA_DATA), cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } },
        { repeatCell: { range: colonna(COLONNA_FATTURATO), cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "€ #,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } },
      ],
    },
  });
}

/**
 * Crea il file DIRETTAMENTE dentro la cartella (un solo `files.create`, non un create-poi-sposta:
 * a differenza di Sheets API `spreadsheets.create`, che lo metterebbe nella root di "My Drive"),
 * poi scrive il modello (impostaModelloContatti sopra) via Sheets API sullo stesso file id.
 */
async function creaFile(cartellaId: string, nome: string): Promise<string> {
  const res = await getDrive().files.create({
    requestBody: { name: nome, mimeType: MIME_SHEET, parents: [cartellaId] },
    fields: "id",
    supportsAllDrives: true,
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error(`Creazione del file "${nome}" non riuscita`);

  await impostaModelloContatti(fileId);

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
