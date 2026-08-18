export type Cliente = {
  clienteId: string;
  nome: string;
  adAccountId: string;
  accessCode: string;
  attivo: boolean;
  consulenteId: string;
  targetCpa: number | null;
  targetCpl: number | null;
  mostraTabExtra: boolean;
  prodottoId: string; // vuoto se nessun prodotto assegnato (cliente pre-esistente o senza roadmap)
  dataInizioProgetto: string | null; // YYYY-MM-DD, base per il calcolo delle scadenze della roadmap
  // action_type esatto di Meta Insights da contare come "lead" per questo cliente (es.
  // "offsite_conversion.fb_pixel_complete_registration" per un cliente che traccia iscrizioni a
  // webinar/eventi invece di Lead Ads classici). Vuoto = usa la lista di default (LEAD_ACTION_PRIORITY
  // in src/lib/meta.ts) — comportamento invariato per tutti i clienti esistenti.
  tipoConversioneLead: string;
  // Destinatario dell'invio automatico dell'email di follow-up meeting. Vuota = invio automatico
  // disattivato per questo cliente (resta solo il flusso manuale scarica PDF/copia email).
  email: string;
};

export type Consulente = {
  consulenteId: string;
  nome: string;
  password: string;
  attivo: boolean;
  // Mittente reale dell'invio automatico (Gmail API, delega a livello di dominio — vedi
  // src/lib/gmail.ts): l'email parte "da" questa casella, impersonata via service account.
  email: string;
};

export type Ruolo = "admin" | "consulente";

export type Sessione = {
  ruolo: Ruolo;
  consulenteId?: string;
};

export type Salute = "scala" | "mantieni" | "interveni" | "dati-insufficienti" | "no-target";

export type Campagna = {
  campaignId: string;
  clienteId: string;
  nomeCampagna: string;
  tipoCampagna: string;
  stato: string; // valore grezzo Meta: ACTIVE, PAUSED, DELETED, ARCHIVED, ...
};

export type MetaDailyRow = {
  data: string; // YYYY-MM-DD
  clienteId: string;
  campaignId: string;
  spesa: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  lead: number;
};

export type FunnelRow = {
  mese: string; // YYYY-MM
  clienteId: string;
  tipoCampagna: string;
  richieste: number;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  vendite: number;
  fatturato: number;
};

export type KpiGroup = {
  tipoCampagna: string;
  investimento: number;
  numeroLead: number;
  costoPerLead: number | null;
  numeroRichieste: number;
  costoPerRichiesta: number | null;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  percentualeEffettuatiSuFissati: number | null;
  costoPerAppuntamentoEffettuato: number | null;
  numeroVendite: number;
  tassoDiChiusura: number | null;
  fatturato: number;
  roas: number | null;
  cpa: number | null;
};

export type RigaCampagna = {
  campaignId: string;
  nomeCampagna: string;
  tipoCampagna: string;
  stato: string;
  statoDal: string | null; // ISO datetime dell'ultimo cambio di stato rilevato, null se mai rilevato
  investimento: number;
  numeroLead: number;
  costoPerLead: number | null;
};

export type CampagnaDisponibile = {
  campaignId: string;
  nomeCampagna: string;
  tipoCampagna: string;
  stato: string;
};

export type KpiResponse = {
  cliente: { clienteId: string; nome: string };
  periodo: { da: string; a: string };
  gruppi: KpiGroup[];
  totale: KpiGroup;
  trend: { mese: string; investimento: number; fatturato: number; numeroLead: number }[];
  trendSettimanale: { settimana: string; investimento: number; fatturato: number | null; numeroLead: number }[];
  campagne: RigaCampagna[];
  campagneDisponibili: CampagnaDisponibile[];
};

export type Prodotto = {
  prodottoId: string;
  nome: string;
  attivo: boolean;
  durataSettimane: number;
  note: string;
};

/** Riga del template di roadmap di un prodotto — mai scritta dall'app, solo letta ed editabile a mano sul foglio. */
export type TemplateTask = {
  prodottoId: string;
  taskId: string;
  blocco: string; // testo libero, es. "setup" / "gestione" — stesso spirito di tipo_campagna
  fase: string; // etichetta leggibile della fase, es. "Sett. 1 - Strategia & analisi"
  descrizione: string;
  responsabile: string;
  tipo: string; // sigla per il colore/tooltip, es. "PM" / "CS" / "CL" / "MIL" (milestone)
  settimanaInizio: number;
  settimanaFine: number;
  giorniTesto: string; // solo display, es. "gg 1-3" — la matematica delle date usa sempre le settimane
  nota: string;
  ordine: number;
};

export type StatoAttivita = "todo" | "wip" | "done" | "blocked";

/** Riga di roadmap istanziata per un cliente specifico — snapshot del template al momento della generazione. */
export type AttivitaClienteRow = {
  attivitaId: string; // `${clienteId}::${taskId}`, deterministico
  clienteId: string;
  prodottoId: string;
  taskId: string;
  blocco: string;
  fase: string;
  descrizione: string;
  responsabile: string;
  tipo: string;
  dataInizio: string; // YYYY-MM-DD
  dataFine: string; // YYYY-MM-DD
  stato: StatoAttivita;
  notaTeam: string;
  ordine: number;
};
