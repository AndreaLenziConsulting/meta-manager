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
  // Nome e cognome della persona di contatto (il referente con cui si parla), oltre alla ragione
  // sociale dell'azienda — stesso schema di ragioneSociale/tipoBusiness/fatturato/sedi sotto: mai
  // chiesto in fase di creazione (vedi NuovoProspectForm.tsx), popolato/aggiornato dal report
  // (estrazione o a mano), sincronizzato sul prospect a ogni salvataggio.
  nomeContatto: string;
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
  // /api/prospect/converti). Compilati a mano, restano di solo riferimento (mai un calcolo
  // automatico) — per quello vedi calcolatoreBudget sotto.
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

  // Calcolatore Budget del prospect — una sezione a parte (non più dentro il report, vedi
  // ReportCommercialeDataLoose sotto), raggiungibile da /dashboard/commerciale/[prospectId]/calcolatore.
  // UN calcolatore per prospect (non uno per report/chiamata): la stessa proiezione che il
  // commerciale affina nel tempo, non uno snapshot per singola call. Alimenta la precompilazione
  // dei target della Sede alla conversione (vedi ConvertiProspectModal.tsx/POST
  // /api/prospect/converti) e resta consultabile per intero dal consulente post-vendita nel tab
  // "Vendita" della scheda cliente (vedi GET /api/clienti/report-vendita).
  calcolatoreBudget: CalcolatoreBudgetInput | null;
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
 * Input del Calcolatore Budget del prospect (Prospect.calcolatoreBudget sopra) — un calcolo "al
 * contrario": parte da un fatturato mensile obiettivo (non da un budget) e deriva quante
 * vendite/appuntamenti/lead servono e quale budget media serve per raggiungerlo — vedi
 * calcolaCalcolatoreBudget/calcolaPianoAnnualeBudget in src/lib/roiSimulatore.ts. Vive sul
 * prospect (11/2026: prima era dentro ogni singolo ReportCommerciale — spostato in una sezione a
 * parte, vedi ReportCommercialeDataLoose sotto, così resta UNA proiezione per prospect invece di
 * una per chiamata). ScenarioRoi sopra resta invariato: lo usa ancora PerformancePrevisionale.tsx
 * (proiezione in avanti da un budget dato, nel tab KPI di un cliente già attivo — tutt'altra
 * funzionalità).
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
  // Appuntamento di chiusura (con presentazione di un'offerta) o di scoperta — mai estratto dal
  // modello: richiede un giudizio esplicito del commerciale su COME si è svolta la chiamata, non
  // deducibile con sicurezza dal solo contenuto. `undefined`/`false` = scoperta (il default).
  chiamataDiChiusura?: boolean;

  // Dati del cliente — pre-compilati dal Prospect salvato, sovrascritti da quanto trovato
  // nell'estrazione se non vuoto; editabili in ogni caso prima di salvare.
  ragioneSociale?: string;
  nomeContatto?: string; // nome e cognome del referente, oltre alla ragione sociale
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;

  // Il "racconto" della chiamata in 4 sezioni narrative (11/2026 — sostituisce le vecchie sezioni
  // Criticità/Tentate Soluzioni/PAIN/Comunicazione Corretta secondo AL, fuse qui invece di restare
  // separate: un report più scorrevole da leggere, richiesta esplicita dell'utente). Il "Livello
  // Problema" del vecchio metodo di comunicazione ALC non è sparito nella sostanza: il prompt di
  // estrazione (estrazioneCommerciale.ts) chiede comunque a quadroEmerso/strategiaProposta di
  // essere scritti nel linguaggio/vissuto del prospect, non tecnico — solo non è più un campo a sé.
  quadroEmerso?: string; // criticità + cosa ha già provato + il pain reale, in un racconto unico
  obiettivi?: string; // obiettivi aziendali del prospect
  strategiaProposta?: string; // il ragionamento/approccio proposto in risposta al quadro emerso
  soluzioneProposta?: string; // dettaglio concreto del servizio/offerta proposta
  prossimiPassi?: string;

  // Target commerciali — due numeri semplici inseriti a mano dal commerciale, mai calcolati (per
  // il calcolo vero vedi Prospect.calcolatoreBudget, sezione a parte): un "promemoria" rapido di
  // cosa concordato in questa chiamata, non una proiezione. Mai estratti dal modello.
  budgetMedioMensile?: number | null;
  fatturatoAttesoMensile?: number | null;
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
