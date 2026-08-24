/**
 * Contratto dati per il Report Commerciale — mirror strutturale di `types/meeting.ts` ma per il
 * dominio "prospect" (potenziale cliente, prima ancora di entrare in Meta Manager ALC come
 * Cliente). Tutti i campi del report sono opzionali/con default, stesso spirito "loose" di
 * `MeetingDataLoose": un campo mancante nell'estrazione arriva vuoto, mai un crash a runtime.
 */

export type Commerciale = {
  commercialeId: string;
  nome: string;
  password: string;
  attivo: boolean;
  // Mittente reale dell'invio automatico (Gmail API, delega a livello di dominio — vedi
  // src/lib/gmail.ts): l'email parte "da" questa casella, impersonata via service account.
  email: string;
};

/**
 * Anagrafica persistente del prospect — i 4 campi "Dati del cliente" del report vivono qui, non
 * solo dentro il singolo report: si aggiornano a ogni salvataggio così non vanno re-inseriti al
 * report successivo (vedi ReportCommercialeRow.dati, che li porta con sé come snapshot storico).
 */
export type Prospect = {
  prospectId: string;
  ragioneSociale: string;
  tipoBusiness: string;
  fatturato: string; // testo libero (spesso una stima/range, non un numero preciso auto-dichiarato)
  sedi: string; // testo libero — quante/quali sedi ha il business del prospect, non l'entità Sede dell'app
  email: string; // destinatario dell'invio automatico del report — vuota = invio disattivato
  commercialeId: string;
  attivo: boolean;
  creatoIl: string; // ISO datetime
};

export type ScenarioRoi = {
  nome: string;
  budgetMensile: number | null;
  cpl: number | null;
  tassoAppuntamento: number | null; // % lead -> appuntamento fissato, 0-100
  tassoChiusura: number | null; // % appuntamento -> vendita, 0-100
  valoreMedioVendita: number | null;
};

export type ReportCommercialeDataLoose = {
  titolo?: string;
  data?: string; // "DD/MM/YYYY", stessa convenzione di MeetingDataLoose.date
  partecipanti?: string[];
  rawUrl?: string;

  // Dati del cliente — pre-compilati dal Prospect salvato, sovrascritti da quanto trovato
  // nell'estrazione se non vuoto; editabili in ogni caso prima di salvare.
  ragioneSociale?: string;
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;

  criticita?: string;
  tentateSoluzioni?: string;
  pain?: string;
  obiettivi?: string;
  soluzioneProposta?: string;
  livelloProblema?: string;
  livelloProdotto?: string;
  prossimiPassi?: string;

  // Mai estratta dal modello — sempre compilata a mano nell'editor, vedi src/lib/roiSimulatore.ts.
  scenarioA?: ScenarioRoi;
  scenarioB?: ScenarioRoi;
};

/** Riga così com'è persistita/letta dalla tab ReportCommerciale. */
export type ReportCommercialeRow = {
  reportId: string;
  prospectId: string;
  commercialeId: string;
  data: string; // YYYY-MM-DD (data della chiamata, non del salvataggio)
  aggiornatoIl: string; // ISO datetime dell'ultimo salvataggio
  dati: ReportCommercialeDataLoose;
};
