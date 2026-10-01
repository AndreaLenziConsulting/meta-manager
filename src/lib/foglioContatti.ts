import { google } from "googleapis";
import { getGoogleOAuth2Client } from "@/lib/googleAuth";
import { settimanaDiData } from "@/lib/kpi";
import type { GhlBreakdownCampagna, GhlRiepilogoResponse } from "@/types/ghl";

// "File contatti" del cliente (Cliente.appuntamentiFileUrl) — la fonte di appuntamenti, vendite e
// fatturato per le sedi SENZA GHL (richiesta utente 01/10/2026: "ridefinire il file di appuntamenti
// che viene letto quando non c'è GHL").
//
// Prima il file collegato era un foglio mensile (Mese/Richieste/Appuntamenti/Vendite/Fatturato) che
// l'app creava ma non leggeva mai, e che nessun cliente ha mai compilato. Il formato nuovo è quello
// dei file "Contatti Acquisition Control" già in uso: UNA RIGA PER CONTATTO, con
// - un menù a tendina "stato" (Da contattare / Non lavorabile / In contatto / Appuntamento fissato /
//   Appuntamento effettuato / Vendita), aggiornato a mano dal cliente o dal team;
// - una colonna fatturato subito a destra dello stato.
// Le righe arrivano dall'esportazione dei moduli Meta (id lead, data, id inserzione, id campagna...)
// oppure sono scritte a mano nel modello creato dall'app (vedi appuntamentiFile.ts).
//
// Il foglio è letto a ogni richiesta (cache di 30 secondi): cambiare uno stato o un fatturato nel
// file si riflette in app al caricamento successivo, senza nessuna sincronizzazione.
//
// COSA SI PUÒ E NON SI PUÒ SAPERE da questo file: c'è la data in cui il contatto è ARRIVATO, non
// quella in cui ha fissato l'appuntamento o comprato. Per questo, a differenza di GHL (che conta
// l'appuntamento nel giorno in cui è stato fissato), qui un periodo contiene i contatti ARRIVATI in
// quel periodo, ciascuno nello stato in cui si trova oggi. Le note in interfaccia lo dicono.

type Cella = string | number | boolean | null | undefined;

export type StatoContatto =
  | "da-contattare"
  | "non-lavorabile"
  | "in-contatto"
  | "appuntamento-fissato"
  | "appuntamento-effettuato"
  | "vendita"
  // Testo nella colonna stato che non è una delle voci del menù: il contatto conta come lead, mai
  // come appuntamento o vendita.
  | "altro";

/** Voci del menù a tendina così come sono scritte nei file, in minuscolo. "Non in target" è la
 * variante di "Non lavorabile" in uso in uno dei file esistenti: stesso significato. */
const STATO_DA_TESTO: Record<string, StatoContatto> = {
  "da contattare": "da-contattare",
  "non lavorabile": "non-lavorabile",
  "non in target": "non-lavorabile",
  "in contatto": "in-contatto",
  "appuntamento fissato": "appuntamento-fissato",
  "appuntamento effettuato": "appuntamento-effettuato",
  vendita: "vendita",
};

/** Le voci del menù, nell'ordine dell'imbuto — riusate da appuntamentiFile.ts per creare la tendina
 * nel modello nuovo: un solo elenco, mai due che divergono. */
export const VOCI_STATO_CONTATTO = [
  "Da contattare",
  "Non lavorabile",
  "In contatto",
  "Appuntamento fissato",
  "Appuntamento effettuato",
  "Vendita",
];

export type ContattoFoglio = {
  creatoMs: number;
  /** YYYY-MM-DD (UTC) dell'arrivo del contatto — chiave delle serie settimanali. */
  creatoIl: string;
  campaignId: string | null;
  adId: string | null;
  stato: StatoContatto;
  /** Valore della colonna fatturato, 0 se vuota. Conta nei totali solo per i contatti in "Vendita". */
  fatturato: number;
};

function testo(c: Cella): string {
  return c === null || c === undefined ? "" : String(c).trim();
}

function statoDi(c: Cella): StatoContatto | null {
  return STATO_DA_TESTO[testo(c).toLowerCase()] ?? null;
}

const SHEETS_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

/**
 * Data di arrivo di un contatto da una cella. Tre forme accettate:
 * - ISO con o senza orario ("2026-09-30T01:07:07-05:00", "2026-09-30") — l'esportazione Meta;
 * - "gg/mm/aaaa" — una data scritta a mano come testo;
 * - un numero seriale di Google Sheets — una data scritta a mano in una cella data. Accettato solo
 *   se `ancheSeriale` (cioè solo nella colonna che l'intestazione dichiara come data): un numero
 *   qualunque in un'altra colonna (un fatturato di 45.000 €) non deve mai diventare una data.
 */
function dataDi(c: Cella, ancheSeriale: boolean): number | null {
  if (typeof c === "number") {
    if (!ancheSeriale || c < 36526 || c > 73050) return null; // fuori dal 2000-2100: non è una data
    return SHEETS_EPOCH_UTC_MS + Math.round(c * 86400000);
  }
  const s = testo(c);
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) {
    const ms = new Date(s.length === 10 ? `${s}T00:00:00Z` : s).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const it = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (it) {
    const ms = Date.UTC(Number(it[3]), Number(it[2]) - 1, Number(it[1]));
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** "3500", 3500, "€ 3.500,00", "3500,50" -> numero; vuoto o non leggibile -> 0. */
function importoDi(c: Cella): number {
  if (typeof c === "number") return Number.isFinite(c) ? c : 0;
  const s = testo(c).replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
}

function idConPrefisso(riga: Cella[], prefisso: string): string | null {
  const re = new RegExp(`^${prefisso}:(\\d+)$`);
  for (const c of riga) {
    const m = testo(c).match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Interpreta le righe grezze del foglio. Le colonne NON sono cercate per posizione: i file esistenti
 * le hanno in posti diversi (uno ha una colonna in più prima dello stato, telefono ed email sono
 * invertiti, le domande del modulo cambiano da cliente a cliente). Si riconoscono per contenuto:
 * - colonna STATO: quella con più celle che sono una voce del menù;
 * - colonna FATTURATO: quella subito a destra dello stato;
 * - data, id campagna, id inserzione: nell'esportazione Meta hanno forma inconfondibile (data ISO,
 *   "c:<numero>", "ag:<numero>") e si cercano in tutta la riga; nel modello scritto a mano (prima
 *   riga di intestazioni) si leggono dalle colonne "Data", "ID campagna", "ID inserzione".
 * Una riga senza una data leggibile non è un contatto (intestazione, riga vuota, appunti) e viene
 * scartata. Uno stato vuoto vale "da contattare": è un contatto arrivato e non ancora lavorato.
 * Torna [] se il foglio non ha nessuna colonna di stato — non è (ancora) un file contatti: il
 * chiamante lo tratta come "nessuna fonte", mai come zero appuntamenti.
 */
export function interpretaFoglioContatti(righe: Cella[][]): ContattoFoglio[] {
  const conteggioPerColonna = new Map<number, number>();
  for (const riga of righe) {
    riga.forEach((c, i) => {
      if (statoDi(c)) conteggioPerColonna.set(i, (conteggioPerColonna.get(i) ?? 0) + 1);
    });
  }
  let colStato = -1;
  let massimo = 0;
  for (const [colonna, n] of conteggioPerColonna) {
    if (n > massimo) {
      massimo = n;
      colStato = colonna;
    }
  }
  if (colStato < 0) return [];

  // Intestazioni del modello scritto a mano: solo se la prima riga non è già un contatto.
  const prima = righe[0] ?? [];
  const primaEContatto = prima.some((c) => dataDi(c, false) !== null) || statoDi(prima[colStato]) !== null;
  const intestazioni = primaEContatto ? [] : prima.map((c) => testo(c).toLowerCase());
  const colonnaIntestata = (test: (h: string) => boolean) => intestazioni.findIndex(test);
  const colData = colonnaIntestata((h) => h.startsWith("data"));
  const colCampagna = colonnaIntestata((h) => h.includes("id") && h.includes("campagna"));
  const colInserzione = colonnaIntestata((h) => h.includes("id") && h.includes("inserzione"));
  const idNumerico = (c: Cella) => (/^\d{6,}$/.test(testo(c)) ? testo(c) : null);

  const contatti: ContattoFoglio[] = [];
  righe.forEach((riga, indice) => {
    if (indice === 0 && !primaEContatto) return;
    let creatoMs: number | null = colData >= 0 ? dataDi(riga[colData], true) : null;
    if (creatoMs === null) {
      for (const c of riga) {
        creatoMs = dataDi(c, false);
        if (creatoMs !== null) break;
      }
    }
    if (creatoMs === null) return;
    const statoCella = testo(riga[colStato]);
    contatti.push({
      creatoMs,
      creatoIl: new Date(creatoMs).toISOString().slice(0, 10),
      campaignId: idConPrefisso(riga, "c") ?? (colCampagna >= 0 ? idNumerico(riga[colCampagna]) : null),
      adId: idConPrefisso(riga, "ag") ?? (colInserzione >= 0 ? idNumerico(riga[colInserzione]) : null),
      stato: statoCella === "" ? "da-contattare" : (statoDi(riga[colStato]) ?? "altro"),
      fatturato: importoDi(riga[colStato + 1]),
    });
  });
  return contatti;
}

/** Imbuto cumulativo: chi ha comprato ha per forza fissato ed effettuato un appuntamento, chi l'ha
 * effettuato l'aveva fissato. Il fatturato conta solo per i contatti in "Vendita": un importo
 * scritto accanto a un altro stato è un preventivo o un errore, non un incasso. */
function conta(contatti: ContattoFoglio[]): GhlBreakdownCampagna {
  const fissati = contatti.filter((c) => c.stato === "appuntamento-fissato" || c.stato === "appuntamento-effettuato" || c.stato === "vendita").length;
  const effettuati = contatti.filter((c) => c.stato === "appuntamento-effettuato" || c.stato === "vendita").length;
  const venduti = contatti.filter((c) => c.stato === "vendita");
  return {
    appuntamenti: { totali: fissati, confermati: fissati, annullati: 0, effettuati },
    opportunita: { vendite: venduti.length, fatturato: venduti.reduce((s, c) => s + c.fatturato, 0) },
  };
}

function raggruppa(
  tutti: ContattoFoglio[],
  nelPeriodo: ContattoFoglio[],
  chiave: (c: ContattoFoglio) => string | null
): Record<string, GhlBreakdownCampagna> {
  // Una chiave per ogni campagna/inserzione presente nel file (anche fuori periodo), valori dei soli
  // contatti del periodo — stessa regola di GhlRiepilogoResponse.perCampagna: chiave assente =
  // "nessun contatto attribuito", chiave presente a zero = contatti attribuiti ma nessun risultato.
  const risultato: Record<string, GhlBreakdownCampagna> = {};
  for (const c of tutti) {
    const k = chiave(c);
    if (k && !risultato[k]) risultato[k] = conta(nelPeriodo.filter((x) => chiave(x) === k));
  }
  return risultato;
}

/**
 * Stessa forma della risposta di /api/ghl (GhlRiepilogoResponse), costruita dal file contatti: così
 * tessere, grafici, tabella Dettaglio (per tipo, campagna e inserzione) e Target mensili funzionano
 * per una sede senza GHL esattamente come per una connessa, senza un secondo percorso in interfaccia.
 * `campagneFiltro` = filtro campagne delle tessere (null = nessuno): restringe totali e serie
 * settimanali, mai perCampagna/perInserzione (stesso comportamento della versione GHL).
 */
export function riepilogoDaContatti(
  contatti: ContattoFoglio[],
  startMs: number,
  endMs: number,
  campagneFiltro: Set<string> | null
): GhlRiepilogoResponse {
  const nelPeriodo = contatti.filter((c) => c.creatoMs >= startMs && c.creatoMs <= endMs);
  const scoped = campagneFiltro ? nelPeriodo.filter((c) => c.campaignId !== null && campagneFiltro.has(c.campaignId)) : nelPeriodo;
  const totale = conta(scoped);

  const perSettimana = new Map<string, ContattoFoglio[]>();
  for (const c of scoped) {
    const settimana = settimanaDiData(c.creatoIl);
    perSettimana.set(settimana, [...(perSettimana.get(settimana) ?? []), c]);
  }
  const settimane = Array.from(perSettimana.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return {
    connesso: true,
    fonte: "foglio",
    calendariConfigurati: true,
    calendariFalliti: 0,
    appuntamenti: totale.appuntamenti,
    opportunita: totale.opportunita,
    fatturatoPerSettimana: settimane.map(([settimana, lista]) => {
      const c = conta(lista);
      return { settimana, fatturato: c.opportunita.fatturato, vendite: c.opportunita.vendite };
    }),
    appuntamentiPerSettimana: settimane.map(([settimana, lista]) => {
      const c = conta(lista);
      return { settimana, fissati: c.appuntamenti.totali, effettuati: c.appuntamenti.effettuati };
    }),
    perCampagna: raggruppa(contatti, nelPeriodo, (c) => c.campaignId),
    perInserzione: raggruppa(contatti, nelPeriodo, (c) => c.adId),
    campagneAttribuibili: contatti.some((c) => c.campaignId !== null),
  };
}

/** Id del foglio da un link Google Sheets (".../spreadsheets/d/<id>/edit"), null se non lo è. */
export function idFoglioDaUrl(url: string): string | null {
  return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { righe: Cella[][]; scadenza: number }>();
let sheetsClient: ReturnType<typeof google.sheets> | null = null;

/**
 * Righe grezze del primo foglio del file (valori non formattati: gli importi arrivano come numeri).
 * Stesso account e stessa cache da 30 secondi di sheets.ts. Si rifiuta se il link non è un foglio
 * Google o se l'account dell'app non può leggerlo (file non condiviso): il chiamante lo mostra come
 * errore, mai come "zero appuntamenti".
 */
export async function leggiFoglioContatti(url: string): Promise<Cella[][]> {
  const id = idFoglioDaUrl(url);
  if (!id) throw new Error("Il link del file contatti non è un foglio Google valido");
  const inCache = cache.get(id);
  if (inCache && inCache.scadenza > Date.now()) return inCache.righe;

  if (!sheetsClient) sheetsClient = google.sheets({ version: "v4", auth: getGoogleOAuth2Client() });
  const res = await sheetsClient.spreadsheets.values.get({ spreadsheetId: id, range: "A1:AZ5000", valueRenderOption: "UNFORMATTED_VALUE" });
  const righe = (res.data.values as Cella[][]) ?? [];
  cache.set(id, { righe, scadenza: Date.now() + CACHE_TTL_MS });
  return righe;
}
