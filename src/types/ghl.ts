/**
 * Tipi per l'integrazione Go High Level / Squadd (white-label italiano, stessa API sotto il
 * cofano) — Fase 1: pannello di sola lettura "vendite e appuntamenti" per sede, mai scritto nel
 * Funnel esistente (vedi src/lib/kpi.ts, dato 100% manuale e testato — non toccato da questa
 * feature). Un GhlConnessione vive per sedeId (non clienteId): il "locationId" di GHL è
 * concettualmente la stessa unità di una Sede — un cliente con più sedi fisiche può avere più
 * location GHL separate, stesso motivo per cui adAccountId vive già su Sede e non su Cliente.
 */

/** Riga della tab GhlConnessioni. Il token resta testo semplice, stesso precedente di Consulente.password. */
export type GhlConnessione = {
  connessioneId: string;
  sedeId: string;
  locationId: string;
  privateToken: string;
  attivo: boolean;
  note: string;
  creataIl: string; // ISO datetime
  // Calendari della location da includere nel conteggio appuntamenti — scelta esplicita
  // dell'admin, non un'euristica automatica: una location porta spesso anche calendari "personal"
  // di singoli consulenti che possono essere sia pagine di prenotazione legittime sia, in alcuni
  // casi, impegni non pertinenti — calendarType da solo non basta a distinguerli in modo
  // affidabile (vedi commento su GhlCalendario). [] = non ancora configurato.
  calendarIds: string[];
};

/**
 * `calendarType` verificato con una chiamata reale: "round_robin" | "personal" | "collective".
 * Usato solo come suggerimento di preselezione nel picker (round_robin/collective preselezionati,
 * personal no) — mai come filtro automatico: un calendario "personal" è spesso la pagina di
 * prenotazione dedicata di un singolo consulente, non necessariamente un impegno da escludere.
 */
export type GhlCalendario = { id: string; name: string; calendarType: string };

/**
 * Appuntamento GHL così com'è restituito da /calendars/events. `appointmentStatus` resta stringa
 * libera (non un'unione stretta): nell'account osservati solo "confirmed"/"cancelled" — GHL
 * supporta anche "showed"/"noshow" per chi segna le presenze, ma non va assunto per account che
 * non lo fanno. Per questo "effettuato" (vedi riepilogoAppuntamenti in src/lib/ghl.ts) è uno
 * standard operativo deciso dall'utente (appuntamento passato e mai annullato), non un vero
 * segnale di presenza letto da GHL.
 */
export type GhlAppuntamento = {
  id: string;
  calendarId: string;
  contactId: string;
  title: string;
  appointmentStatus: string;
  startTime: string; // ISO 8601 con offset — quando si TIENE l'incontro
  endTime: string;
  // Quando la prenotazione è stata FATTA — usata per il periodo invece di startTime: un
  // appuntamento fissato ad agosto per un incontro a ottobre resta "fissato ad agosto" anche se
  // poi riprogrammato, coerente con appuntamentiFissati del Funnel esistente (attività del mese,
  // non agenda futura) — vedi riepilogoAppuntamenti in src/lib/ghl.ts.
  dateAdded: string;
  deleted: boolean;
};

export type GhlOpportunita = {
  id: string;
  name: string;
  monetaryValue: number;
  status: string; // "open" | "won" | "lost" | "abandoned" nei fatti osservati, string per sicurezza
  source: string;
  contactId: string;
  createdAt: string;
  // Data dell'ultimo cambio di stato — usata per capire QUANDO un'opportunità è stata vinta, non
  // quando è stata creata. Il filtro date/endDate di /opportunities/search filtra per createdAt
  // (verificato con una chiamata reale), semanticamente sbagliato per "vendite del periodo": una
  // trattativa aperta mesi fa e chiusa questo mese va contata come vendita di questo mese, non
  // persa perché creata prima — vedi riepilogoOpportunita in src/lib/ghl.ts.
  lastStatusChangeAt: string;
};

/** Riepilogo aggregato per un periodo — deliberatamente NON compatibile con KpiGroup, vedi kpi.ts. */
export type GhlRiepilogoResponse =
  | { connesso: false }
  | {
      connesso: true;
      // false se la connessione esiste ma nessun calendario è ancora stato selezionato — gli
      // appuntamenti restano a zero finché l'admin non sceglie quali calendari includere, invece
      // di includerli tutti in automatico (vedi GhlConnessione.calendarIds).
      calendariConfigurati: boolean;
      appuntamenti: { totali: number; confermati: number; annullati: number; effettuati: number };
      opportunita: { vendite: number; fatturato: number };
      // Stesso fatturato di `opportunita.fatturato`, ma spezzato per mese (lastStatusChangeAt) —
      // alimenta il grafico del tab KPI, tracciato a livello mensile. Vedi fatturatoGhlPerMese in
      // lib/ghl.ts.
      fatturatoPerMese: { mese: string; fatturato: number }[];
      // >0 se uno o più calendari erano irraggiungibili al momento della richiesta (dopo un
      // retry) — il conteggio appuntamenti è quindi parziale, non un vero zero. Vedi fetchAppuntamenti.
      calendariFalliti: number;
    };
