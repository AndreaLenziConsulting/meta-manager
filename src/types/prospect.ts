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
  // Cliente vero e proprio (il collegamento prospect→cliente è la conversione sopra, ma questi
  // target NON vengono copiati automaticamente sul Cliente: sono metriche commerciali — CPL,
  // CPA-appuntamento — diverse per definizione dai target ads di una Sede, vedi POST
  // /api/prospect/converti): pensati per alimentare, in un giro successivo, sia il Simulatore ROI
  // (oggi compilato a mano ogni volta, vedi ScenarioRoi sotto) sia gli indicatori di performance
  // reali una volta collegati a una Sede — qui solo lo storage, non ancora consumati.
  driveFolderUrl: string; // link alla cartella Drive del prospect — creato in automatico alla
  // creazione del prospect (vedi assicuraCartelleProspect in drive.ts), sovrascrivibile a mano
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

  // Esito dell'hand-off commerciale→consulente (vedi POST /api/prospect/converti): vuoto = prospect
  // non ancora convertito. Non vuoto = clienteId del Cliente creato da questo prospect. La
  // conversione NON tocca `attivo`, a differenza di come si "chiude" tutto il resto nell'app:
  // disattivarlo lo farebbe sparire da prospectVisibili/puoVedereProspect (filtrano su `attivo`)
  // prima ancora di poter vedere il badge "Convertito in cliente" o riconsultare i vecchi report —
  // resta quindi visibile come ogni altro prospect, solo marcato.
  clienteId: string;

  // Proposta di conversione: il commerciale segna un prospect vinto e suggerisce (facoltativo, può
  // restare vuoto) un consulente — solo admin esegue davvero POST /api/prospect/converti (stesso
  // motivo per cui solo admin crea un Cliente in generale). Vuoto = nessuna proposta in corso.
  // Sopravvive alla conversione (non viene ripulito): resta come nota storica di chi era stato
  // suggerito, ClienteId sopra è il segnale definitivo di "già convertito".
  consulenteSuggeritoId: string;
};

export type ScenarioRoi = {
  nome: string;
  budgetMensile: number | null;
  cpl: number | null;
  tassoAppuntamento: number | null; // % lead -> appuntamento fissato, 0-100
  tassoChiusura: number | null; // % appuntamento -> vendita, 0-100
  valoreMedioVendita: number | null;
};

/**
 * Input del Calcolatore Budget nel Report Commerciale — sostituisce (11/2026) i 2 scenari
 * ScenarioRoi affiancati con un unico calcolo "al contrario": parte da un fatturato mensile
 * obiettivo (non da un budget) e deriva quante vendite/appuntamenti/lead servono e quale budget
 * media serve per raggiungerlo — vedi calcolaCalcolatoreBudget/calcolaPianoAnnualeBudget in
 * src/lib/roiSimulatore.ts. ScenarioRoi sopra resta invariato: lo usa ancora
 * PerformancePrevisionale.tsx (proiezione in avanti da un budget dato, nel tab KPI di un cliente
 * già attivo — tutt'altra funzionalità, non toccata da questa sostituzione).
 */
export type CalcolatoreBudgetInput = {
  fatturatoMensile: number | null; // € di fatturato mensile obiettivo
  ticketMedio: number | null; // € valore medio di una vendita
  margine: number | null; // % di utile medio sul fatturato, 0-100
  cpl: number | null; // € costo per lead atteso
  tassoAppuntamento: number | null; // % lead -> appuntamento fissato, 0-100
  tassoChiusura: number | null; // % appuntamento -> vendita, 0-100
  variazioneStagionale: number | null; // % ampiezza della curva stagionale, 0 = costante, 50 = curva piena
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

  // Mai estratto dal modello — sempre compilato a mano nell'editor, vedi src/lib/roiSimulatore.ts.
  calcolatoreBudget?: CalcolatoreBudgetInput;
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
