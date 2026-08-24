export type Cliente = {
  clienteId: string;
  nome: string;
  accessCode: string;
  attivo: boolean;
  consulenteId: string;
  mostraTabExtra: boolean;
  prodottoId: string; // vuoto se nessun prodotto assegnato (cliente pre-esistente o senza roadmap)
  dataInizioProgetto: string | null; // YYYY-MM-DD, base per il calcolo delle scadenze della roadmap
  // Destinatario dell'invio automatico dell'email di follow-up meeting. Vuota = invio automatico
  // disattivato per questo cliente (resta solo il flusso manuale scarica PDF/copia email).
  email: string;
};

/**
 * Un cliente ha sempre almeno una sede (dopo la migrazione — vedi memoria di progetto): "sede" è
 * l'unità reale di business (es. un punto vendita), ognuna col proprio account pubblicitario e la
 * propria pipeline di appuntamenti/vendite. adAccountId/target/tipoConversioneLead vivevano su
 * Cliente prima di questa evoluzione — sono specifici della sede, non del cliente in astratto.
 */
export type Sede = {
  sedeId: string;
  clienteId: string;
  nome: string; // es. "Milano" — mostrato nel selettore quando il cliente ne ha più di una
  adAccountId: string;
  targetCpa: number | null;
  targetCpl: number | null;
  // action_type esatto di Meta Insights da contare come "lead" per questa sede (es.
  // "offsite_conversion.fb_pixel_complete_registration" per una sede che traccia iscrizioni a
  // webinar/eventi invece di Lead Ads classici). Vuoto = usa la lista di default (LEAD_ACTION_PRIORITY
  // in src/lib/meta.ts) — comportamento invariato per tutte le sedi esistenti.
  tipoConversioneLead: string;
  attivo: boolean;
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

export type Ruolo = "admin" | "consulente" | "commerciale";

export type Sessione = {
  ruolo: Ruolo;
  consulenteId?: string;
  commercialeId?: string;
};

export type Salute = "scala" | "mantieni" | "interveni" | "dati-insufficienti" | "no-target";

export type Campagna = {
  campaignId: string;
  clienteId: string;
  sedeId: string; // quale sede del cliente possiede l'account pubblicitario da cui arriva questa campagna
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
  sedeId: string; // inserito a mano insieme al resto della riga — non derivabile da nient'altro
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
  // targetCpa/targetCpl presenti solo nella richiesta interna (clienteId, sessione autenticata) —
  // mai nel ramo pubblico (code), per non esporre i target al cliente. Vedi src/app/api/kpi/route.ts.
  sede: { sedeId: string; nome: string; targetCpa?: number | null; targetCpl?: number | null };
  // Sempre presente (anche su code): popola il selettore quando il cliente ha più di una sede.
  sediDisponibili: { sedeId: string; nome: string }[];
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
