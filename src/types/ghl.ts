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
};

export type GhlCalendario = { id: string; name: string };

/**
 * Appuntamento GHL così com'è restituito da /calendars/events. `appointmentStatus` resta stringa
 * libera (non un'unione stretta): nell'account di test osservati solo "confirmed"/"cancelled" —
 * GHL supporta anche "showed"/"noshow" per chi segna le presenze, ma non va assunto per account
 * che non lo fanno. Vedi riepilogoAppuntamenti in src/lib/ghl.ts.
 */
export type GhlAppuntamento = {
  id: string;
  calendarId: string;
  contactId: string;
  title: string;
  appointmentStatus: string;
  startTime: string; // ISO 8601 con offset
  endTime: string;
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
      appuntamenti: { totali: number; confermati: number; annullati: number };
      opportunita: { vendite: number; fatturato: number };
    };
