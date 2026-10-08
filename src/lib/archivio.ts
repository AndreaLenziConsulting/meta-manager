import * as foglio from "@/lib/sheets";
import * as database from "@/lib/db/archivio";

/**
 * L'archivio dei dati dell'app: clienti, sedi, campagne, dati giornalieri, attività, meeting, prospect…
 * Tutto il resto del codice importa da qui, e non sa dove i dati stanno davvero. Sono due i posti
 * possibili, con le stesse identiche funzioni:
 *   - il foglio Google (src/lib/sheets.ts), l'archivio storico dell'app;
 *   - il database Postgres su Supabase (src/lib/db/archivio.ts).
 *
 * Quale dei due lo decide la variabile `ARCHIVIO_DATI`: `database` per il database, qualunque altro
 * valore (o nessuno) per il foglio. Si legge a ogni chiamata: per tornare al foglio basta cambiare la
 * variabile, senza toccare il codice. I due archivi NON si tengono allineati da soli: ciò che viene
 * scritto in uno non compare nell'altro (vedi scripts/copia-foglio-nel-database.ts per la copia).
 *
 * Ciò che dall'08/10/2026 si gestisce dall'app invece che a mano (squadra, prodotti, modelli di
 * attività, risultati commerciali) si scrive solo sul database: sul foglio quelle funzioni rispondono
 * con un errore che lo dice.
 */
type Archivio = typeof database;

// Controllo a tempo di compilazione: ogni funzione dell'archivio esiste anche sul foglio, con la stessa firma.
void (foglio satisfies Archivio);

export function archivioAttivo(): "database" | "foglio" {
  return process.env.ARCHIVIO_DATI === "database" ? "database" : "foglio";
}

function scegli<K extends keyof Archivio>(nome: K): Archivio[K] {
  const funzione = (...argomenti: unknown[]) => {
    const archivio: Archivio = archivioAttivo() === "database" ? database : foglio;
    return (archivio[nome] as (...a: unknown[]) => unknown)(...argomenti);
  };
  return funzione as Archivio[K];
}

export const getClienti = scegli("getClienti");
export const getClienteByAccessCode = scegli("getClienteByAccessCode");
export const creaCliente = scegli("creaCliente");
export const aggiornaCliente = scegli("aggiornaCliente");
export const migraFunnelClientiEsistenti = scegli("migraFunnelClientiEsistenti");
export const eliminaCliente = scegli("eliminaCliente");
export const getSedi = scegli("getSedi");
export const creaSede = scegli("creaSede");
export const aggiornaSede = scegli("aggiornaSede");
export const eliminaSede = scegli("eliminaSede");
export const getGhlConnessioni = scegli("getGhlConnessioni");
export const creaGhlConnessione = scegli("creaGhlConnessione");
export const aggiornaGhlConnessione = scegli("aggiornaGhlConnessione");
export const eliminaGhlConnessione = scegli("eliminaGhlConnessione");
export const getCategorieCommerciali = scegli("getCategorieCommerciali");
export const creaCategoriaCommerciale = scegli("creaCategoriaCommerciale");
export const aggiornaCategoriaCommerciale = scegli("aggiornaCategoriaCommerciale");
export const eliminaCategoriaCommerciale = scegli("eliminaCategoriaCommerciale");
export const getVenditori = scegli("getVenditori");
export const creaVenditore = scegli("creaVenditore");
export const aggiornaVenditore = scegli("aggiornaVenditore");
export const eliminaVenditore = scegli("eliminaVenditore");
export const getRisultatiVenditori = scegli("getRisultatiVenditori");
export const salvaRisultatiVenditori = scegli("salvaRisultatiVenditori");
export const getConnessioniCanale = scegli("getConnessioniCanale");
export const creaConnessioneCanale = scegli("creaConnessioneCanale");
export const aggiornaConnessioneCanale = scegli("aggiornaConnessioneCanale");
export const eliminaConnessioneCanale = scegli("eliminaConnessioneCanale");
export const migraConnessioniMeta = scegli("migraConnessioniMeta");
export const migraSediEsistenti = scegli("migraSediEsistenti");
export const migraAssegnatariEsistenti = scegli("migraAssegnatariEsistenti");
export const getConsulenti = scegli("getConsulenti");
export const getCommerciali = scegli("getCommerciali");
export const getCredenzialiAccesso = scegli("getCredenzialiAccesso");
export const creaMembroSquadra = scegli("creaMembroSquadra");
export const aggiornaMembroSquadra = scegli("aggiornaMembroSquadra");
export const eliminaMembroSquadra = scegli("eliminaMembroSquadra");
export const getProdotti = scegli("getProdotti");
export const creaProdotto = scegli("creaProdotto");
export const aggiornaProdotto = scegli("aggiornaProdotto");
export const eliminaProdotto = scegli("eliminaProdotto");
export const getTemplateAttivita = scegli("getTemplateAttivita");
export const salvaTemplateTask = scegli("salvaTemplateTask");
export const eliminaTemplateTask = scegli("eliminaTemplateTask");
export const riordinaTemplateAttivita = scegli("riordinaTemplateAttivita");
export const getCampagne = scegli("getCampagne");
export const ensureCampagneMappate = scegli("ensureCampagneMappate");
export const spostaCampagneASede = scegli("spostaCampagneASede");
export const aggiornaStatoCampagne = scegli("aggiornaStatoCampagne");
export const getStoricoStatoCampagne = scegli("getStoricoStatoCampagne");
export const getUltimoCambioPerCampagna = scegli("getUltimoCambioPerCampagna");
export const getMetaDaily = scegli("getMetaDaily");
export const upsertMetaDailyRows = scegli("upsertMetaDailyRows");
export const getRisultatiCommerciali = scegli("getRisultatiCommerciali");
export const salvaRisultatiCommerciali = scegli("salvaRisultatiCommerciali");
export const getAttivitaCliente = scegli("getAttivitaCliente");
export const creaAttivitaPerCliente = scegli("creaAttivitaPerCliente");
export const aggiornaStatoAttivita = scegli("aggiornaStatoAttivita");
export const aggiornaScadenzaAttivita = scegli("aggiornaScadenzaAttivita");
export const aggiornaAssegnatariAttivita = scegli("aggiornaAssegnatariAttivita");
export const eliminaAttivita = scegli("eliminaAttivita");
export const getFasiCompletate = scegli("getFasiCompletate");
export const registraFaseCompletata = scegli("registraFaseCompletata");
export const getMeetingCliente = scegli("getMeetingCliente");
export const salvaMeeting = scegli("salvaMeeting");
export const eliminaMeeting = scegli("eliminaMeeting");
export const getProspect = scegli("getProspect");
export const creaProspect = scegli("creaProspect");
export const aggiornaProspect = scegli("aggiornaProspect");
export const eliminaProspect = scegli("eliminaProspect");
export const getReportCommerciale = scegli("getReportCommerciale");
export const salvaReportCommerciale = scegli("salvaReportCommerciale");

// Ciò che non è archivio ma che il resto dell'app importava dallo stesso modulo: il report di
// operatività (sta su un altro foglio Google, e lì resta) e le funzioni di sola conversione.
export {
  appendReportOperativita,
  costruisciRichiesteEliminazione,
  guessTipoCampagnaFromNome,
  normalizeData,
  normalizeMese,
  serialToIsoDate,
  toNumber,
  toNumberOrNull,
  trovaIndiceRigaAttivita,
  trovaIndiceRigaCliente,
  trovaTuttiIndiciRiga,
  ultimoCambioDaRighe,
} from "@/lib/sheets";
export type * from "@/lib/sheets";
