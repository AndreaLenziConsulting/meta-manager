import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleOAuth2Client } from "@/lib/googleAuth";
import { nomeCartellaPrincipale, nomeCartellaReport } from "@/lib/driveNomi";

const MIME_FOLDER = "application/vnd.google-apps.folder";

let driveCache: ReturnType<typeof google.drive> | null = null;

function getDrive() {
  if (!driveCache) driveCache = google.drive({ version: "v3", auth: getGoogleOAuth2Client() });
  return driveCache;
}

function getSharedDriveId(): string {
  const id = process.env.GOOGLE_DRIVE_COMMERCIALE_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_COMMERCIALE_ID non configurato");
  return id;
}

/** Google Drive non ha un modo di escapare l'apice dentro una query `q` se non col backslash. */
function escapeQ(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Cerca una cartella per nome esatto dentro un genitore. Ritorna il primo match o null.
 * `includeItemsFromAllDrives`/`supportsAllDrives` sono necessari perché il genitore vive dentro
 * uno shared drive, non "My Drive" — senza questi due flag l'API v3 li ignora silenziosamente
 * (0 risultati, mai un errore) invece di segnalare il problema. */
async function trovaCartella(parentId: string, nome: string): Promise<string | null> {
  const res = await getDrive().files.list({
    q: `'${parentId}' in parents and name = '${escapeQ(nome)}' and mimeType = '${MIME_FOLDER}' and trashed = false`,
    fields: "files(id)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function creaCartella(parentId: string, nome: string): Promise<string> {
  const res = await getDrive().files.create({
    requestBody: { name: nome, mimeType: MIME_FOLDER, parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error(`Creazione cartella Drive "${nome}" non riuscita`);
  return res.data.id;
}

/** Get-or-create per nome, idempotente — sicuro da richiamare più volte sullo stesso genitore,
 * mai una cartella duplicata (a differenza di una create-and-forget). */
async function trovaOCreaCartella(parentId: string, nome: string): Promise<string> {
  return (await trovaCartella(parentId, nome)) ?? (await creaCartella(parentId, nome));
}

/**
 * Get-or-create della sottocartella "Report chiamate | <ragione sociale>" dentro una cartella
 * principale già nota (id ricavato da Prospect.driveFolderUrl — vedi idCartellaDaUrl in
 * driveNomi.ts). Esportata a sé perché il chiamante più comune (upload di un report) di solito
 * conosce già la cartella principale e non deve rifare anche quella ricerca.
 */
export async function trovaOCreaCartellaReport(cartellaPrincipaleId: string, ragioneSociale: string): Promise<string> {
  return trovaOCreaCartella(cartellaPrincipaleId, nomeCartellaReport(ragioneSociale));
}

export type CartelleProspect = { principaleId: string; principaleUrl: string; reportFolderId: string };

/**
 * Garantisce che esistano (creandole se mancano, mai duplicandole grazie al get-or-create per
 * nome) sia la cartella principale del prospect sia la sua sottocartella "Report chiamate", dentro
 * lo shared drive del team (GOOGLE_DRIVE_COMMERCIALE_ID). Idempotente e chiamabile da due punti
 * diversi: alla creazione del prospect (creazione eager) e, come fallback, al primo upload di un
 * report per un prospect creato prima dell'esistenza di questa funzionalità (che quindi non ha
 * ancora una driveFolderUrl salvata).
 */
export async function assicuraCartelleProspect(ragioneSociale: string): Promise<CartelleProspect> {
  const sharedDriveId = getSharedDriveId();
  const principaleId = await trovaOCreaCartella(sharedDriveId, nomeCartellaPrincipale(ragioneSociale));
  const reportFolderId = await trovaOCreaCartellaReport(principaleId, ragioneSociale);
  return {
    principaleId,
    principaleUrl: `https://drive.google.com/drive/folders/${principaleId}`,
    reportFolderId,
  };
}

/**
 * Carica il PDF di un report nella sua sottocartella. L'identificazione di "è già stato caricato"
 * usa `appProperties.reportId` (metadato invisibile nel nome, mai mostrato all'utente) invece del
 * nome file — il nome visualizzato può cambiare (es. titolo corretto in un salvataggio successivo),
 * l'id del report no: così un secondo upload dello stesso report SOVRASCRIVE il PDF già presente
 * invece di lasciarne due copie in giro.
 */
export async function caricaPdfReport(input: { cartellaId: string; reportId: string; nomeFile: string; pdfBuffer: Buffer }): Promise<void> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${input.cartellaId}' in parents and appProperties has { key='reportId' and value='${escapeQ(input.reportId)}' } and trashed = false`,
    fields: "files(id)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 1,
  });
  const esistenteId = res.data.files?.[0]?.id;
  const media = { mimeType: "application/pdf", body: Readable.from(input.pdfBuffer) };

  if (esistenteId) {
    await drive.files.update({
      fileId: esistenteId,
      requestBody: { name: input.nomeFile },
      media,
      supportsAllDrives: true,
    });
  } else {
    await drive.files.create({
      requestBody: { name: input.nomeFile, parents: [input.cartellaId], appProperties: { reportId: input.reportId } },
      media,
      fields: "id",
      supportsAllDrives: true,
    });
  }
}
