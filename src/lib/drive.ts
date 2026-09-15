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

/** Come trovaOCreaCartella, ma segnala anche se la cartella è stata creata ora o già esisteva —
 * serve a assicuraCartelleProspect sotto per copiare i materiali modello una volta sola, al primo
 * get-or-create che crea davvero la cartella (mai a una successiva chiamata idempotente). */
async function trovaOCreaCartellaConFlag(parentId: string, nome: string): Promise<{ id: string; creata: boolean }> {
  const esistente = await trovaCartella(parentId, nome);
  if (esistente) return { id: esistente, creata: false };
  return { id: await creaCartella(parentId, nome), creata: true };
}

// Nome fisso della cartella "modello" (testimonianze e altri materiali utili da avere già pronti
// per ogni prospect, richiesta utente 11/2026) dentro lo shared drive del team — l'utente ne cura
// il contenuto a mano in Drive, l'app la legge per nome, mai per id (nessuna configurazione env
// aggiuntiva). Se non esiste ancora (nessuno l'ha creata) la copia è semplicemente saltata, non un
// errore: è un arricchimento facoltativo della cartella prospect, non un suo prerequisito.
const NOME_CARTELLA_MODELLO = "Materiali prospect (modello)";

/** Copia (ricorsivamente, sottocartelle incluse) il contenuto di `sorgenteId` dentro
 * `destinazioneId` — un file alla volta via files.copy, l'API Drive non offre un "copia cartella"
 * unico. Best-effort dal chiamante: qui lascia propagare eventuali errori, li assorbe
 * copiaCartellaModello sotto. */
async function copiaContenutoCartella(sorgenteId: string, destinazioneId: string): Promise<void> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${sorgenteId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 1000,
  });
  for (const file of res.data.files ?? []) {
    if (!file.id || !file.name) continue;
    if (file.mimeType === MIME_FOLDER) {
      const sottocartella = await creaCartella(destinazioneId, file.name);
      await copiaContenutoCartella(file.id, sottocartella);
    } else {
      await drive.files.copy({ fileId: file.id, requestBody: { name: file.name, parents: [destinazioneId] }, supportsAllDrives: true });
    }
  }
}

async function copiaCartellaModello(sharedDriveId: string, destinazioneId: string): Promise<void> {
  const modelloId = await trovaCartella(sharedDriveId, NOME_CARTELLA_MODELLO);
  if (!modelloId) return;
  await copiaContenutoCartella(modelloId, destinazioneId);
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
  const { id: principaleId, creata } = await trovaOCreaCartellaConFlag(sharedDriveId, nomeCartellaPrincipale(ragioneSociale));
  const reportFolderId = await trovaOCreaCartellaReport(principaleId, ragioneSociale);

  // Solo alla creazione vera e propria della cartella principale, mai a una successiva chiamata
  // idempotente: altrimenti ogni upload di report su un prospect già esistente riverserebbe di
  // nuovo gli stessi materiali modello. Best-effort: una cartella prospect resta valida anche senza
  // materiali precaricati.
  if (creata) {
    try {
      await copiaCartellaModello(sharedDriveId, principaleId);
    } catch (err) {
      console.error("Copia dei materiali modello nella cartella prospect fallita (non bloccante):", err);
    }
  }

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
