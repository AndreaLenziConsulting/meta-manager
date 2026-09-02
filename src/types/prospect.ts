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

  // Parametri commerciali — impostabili già in fase di prospect, prima ancora che diventi un
  // Cliente vero e proprio (nessun collegamento prospect→cliente esiste ancora, vedi "Modifica
  // dati commerciali" in ProspectTab.tsx): pensati per alimentare, in un giro successivo, sia il
  // Simulatore ROI (oggi compilato a mano ogni volta, vedi ScenarioRoi sotto) sia gli indicatori di
  // performance reali una volta collegati a una Sede — qui solo lo storage, non ancora consumati.
  driveFolderUrl: string; // link alla cartella Drive del prospect — per ora inserito a mano, in
  // futuro creato in automatico alla creazione del prospect (non ancora implementato)
  mediaBudgetMensile: number | null; // € di spesa ads mensile pianificata/concordata
  targetCpl: number | null; // € — target costo per lead
  // Target costo per APPUNTAMENTO fissato, non per vendita: un target sul CPA-vendita è poco
  // sensato in questa fase (troppo poche vendite per periodo per essere un riferimento stabile,
  // stesso motivo per cui calcolaSalute in salute.ts usa il CPL come proxy finché non ci sono
  // vendite) — l'appuntamento fissato è un evento più frequente e quindi un target più affidabile.
  targetCpaAppuntamento: number | null;
  targetLeadSettimana: number | null; // lead attesi a settimana
  targetAppuntamentiSettimana: number | null; // appuntamenti fissati attesi a settimana
  targetFatturatoMensile: number | null; // € di fatturato mensile atteso
  targetMargineVenditaPct: number | null; // % di utile medio per vendita sul fatturato, 0-100
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
