-- Meta Manager ALC — schema iniziale del database (07/10/2026).
--
-- Una tabella per ogni scheda del foglio Google che l'app usa oggi come archivio (src/lib/sheets.ts),
-- con gli stessi dati e gli stessi nomi di campo, in snake_case. Regole seguite:
--   * gli identificativi restano testo: sono quelli già in uso ("mobilieri", "mobilieri--principale"…);
--   * un testo assente è stringa vuota, come nell'app (i tipi TypeScript sono `string`, non
--     `string | null`); sono NULL solo i campi che l'app tratta già come "non impostato"
--     (target numerici, data di inizio progetto, calcolatore budget);
--   * le chiavi esterne ci sono dove l'app elimina già a cascata (cliente → sedi → connessioni…).
--     Campagne, dati giornalieri e storico degli stati NON hanno chiavi esterne: per scelta dell'app
--     restano anche dopo l'eliminazione di una sede o di un cliente;
--   * misure in `double precision` (gli stessi numeri che l'app calcola in JavaScript), conteggi interi.
--   * `posizione` (o `id`, dove c'è) è l'ordine di inserimento: l'app legge le righe in quest'ordine,
--     lo stesso in cui il foglio le restituiva dalla prima all'ultima.
--
-- Sicurezza: su ogni tabella è attiva la row level security SENZA alcuna policy. Le chiavi pubbliche
-- di Supabase (anon/authenticated) non leggono e non scrivono nulla; l'app si collega solo dal
-- server, con le sue credenziali, come faceva col foglio.

-- ───────────────────────── Persone e prodotti ─────────────────────────

create table public.consulenti (
  consulente_id text primary key,
  nome text not null,
  password text not null default '',
  attivo boolean not null default true,
  email text not null default '',
  posizione bigint generated always as identity
);

create table public.commerciali (
  commerciale_id text primary key,
  nome text not null,
  password text not null default '',
  attivo boolean not null default true,
  email text not null default '',
  posizione bigint generated always as identity
);

create table public.prodotti (
  prodotto_id text primary key,
  nome text not null,
  attivo boolean not null default true,
  durata_settimane integer not null default 0,
  note text not null default '',
  posizione bigint generated always as identity
);

-- Roadmap tipo di un prodotto: da qui nasce la roadmap di un cliente.
create table public.template_attivita (
  prodotto_id text not null references public.prodotti (prodotto_id) on delete cascade,
  task_id text not null,
  blocco text not null default '',
  fase text not null default '',
  descrizione text not null default '',
  assegnatari text[] not null default '{}',
  tipo text not null default '',
  settimana_inizio integer not null default 0,
  settimana_fine integer not null default 0,
  giorni_testo text not null default '',
  nota text not null default '',
  ordine integer not null default 0,
  primary key (prodotto_id, task_id),
  posizione bigint generated always as identity
);

-- ───────────────────────── Clienti e sedi ─────────────────────────

create table public.clienti (
  cliente_id text primary key,
  nome text not null,
  -- Codice del link pubblico del cliente. Vuoto = nessun link pubblico.
  access_code text not null default '',
  attivo boolean not null default true,
  -- Riferimenti facoltativi (vuoto = non assegnato): senza chiave esterna, come nel foglio.
  consulente_id text not null default '',
  mostra_tab_extra boolean not null default false,
  prodotto_id text not null default '',
  data_inizio_progetto date,
  email text not null default '',
  logo_url text not null default '',
  colore_primario text not null default '',
  colore_secondario text not null default '',
  font_personalizzato text not null default '',
  drive_folder_url text not null default '',
  landing_page_url text not null default '',
  appuntamenti_file_url text not null default '',
  -- Elenco dei funnel del cliente: [{ id, nome, url }].
  funnels jsonb not null default '[]'::jsonb,
  posizione bigint generated always as identity
);
-- Due clienti non possono avere lo stesso codice di accesso; più clienti possono non averne.
create unique index clienti_access_code_unico on public.clienti (access_code) where access_code <> '';
create index clienti_consulente on public.clienti (consulente_id);

create table public.sedi (
  sede_id text primary key,
  cliente_id text not null references public.clienti (cliente_id) on delete cascade,
  nome text not null,
  ad_account_id text not null default '',
  target_cpa double precision,
  target_cpl double precision,
  tipo_conversione_lead text not null default '',
  attivo boolean not null default true,
  target_budget_mensile double precision,
  target_lead_settimana double precision,
  target_appuntamenti_settimana double precision,
  target_fatturato_mensile double precision,
  -- false = se la sede ha campagne con "ALC" nel nome, di default contano solo quelle.
  tutte_le_campagne boolean not null default false,
  posizione bigint generated always as identity
);
create index sedi_cliente on public.sedi (cliente_id);

create table public.ghl_connessioni (
  connessione_id text primary key,
  sede_id text not null references public.sedi (sede_id) on delete cascade,
  location_id text not null default '',
  private_token text not null default '',
  attivo boolean not null default true,
  note text not null default '',
  creata_il timestamptz not null default now(),
  calendar_ids text[] not null default '{}',
  pipeline_ids text[] not null default '{}',
  posizione bigint generated always as identity
);
create index ghl_connessioni_sede on public.ghl_connessioni (sede_id);

create table public.connessioni_canale (
  connessione_id text primary key,
  sede_id text not null references public.sedi (sede_id) on delete cascade,
  canale text not null default 'meta' check (canale in ('meta', 'google')),
  account_id text not null default '',
  tipo_conversione_lead text not null default '',
  attivo boolean not null default true,
  note text not null default '',
  creata_il timestamptz not null default now(),
  posizione bigint generated always as identity
);
create index connessioni_canale_sede on public.connessioni_canale (sede_id);

create table public.categorie_commerciali (
  categoria_id text primary key,
  sede_id text not null references public.sedi (sede_id) on delete cascade,
  nome text not null,
  tag_ghl text not null default '',
  pipeline_ghl text not null default '',
  attivo boolean not null default true,
  ordine integer not null default 0,
  target_budget_mensile double precision,
  target_lead_settimana double precision,
  target_appuntamenti_settimana double precision,
  target_fatturato_mensile double precision,
  posizione bigint generated always as identity
);
create index categorie_commerciali_sede on public.categorie_commerciali (sede_id);

create table public.venditori (
  venditore_id text primary key,
  sede_id text not null references public.sedi (sede_id) on delete cascade,
  nome text not null,
  capienza_appuntamenti_mensile double precision not null default 0,
  attivo boolean not null default true,
  ghl_user_id text not null default '',
  posizione bigint generated always as identity
);
create index venditori_sede on public.venditori (sede_id);

-- ───────────────────────── Campagne e dati pubblicitari ─────────────────────────

-- Anagrafica delle campagne. Resta anche se la sede o il cliente vengono eliminati (storico).
create table public.campagne (
  canale text not null default 'meta' check (canale in ('meta', 'google')),
  campaign_id text not null,
  cliente_id text not null,
  sede_id text not null default '',
  nome_campagna text not null default '',
  tipo_campagna text not null default '',
  stato text not null default '',
  primary key (canale, campaign_id),
  posizione bigint generated always as identity
);
create index campagne_cliente_sede on public.campagne (cliente_id, sede_id);

-- Un cambio di stato di una campagna (attiva → in pausa…), rilevato a ogni sincronizzazione.
create table public.storico_stato_campagne (
  id bigint generated always as identity primary key,
  cambiato_il timestamptz not null,
  campaign_id text not null,
  cliente_id text not null default '',
  nome_campagna text not null default '',
  stato_precedente text not null default '',
  stato_nuovo text not null default ''
);
create index storico_stato_campagne_campagna on public.storico_stato_campagne (campaign_id, cambiato_il desc);

-- Una riga per cliente, campagna e giorno: spesa e risultati letti dal canale pubblicitario.
-- La chiave comprende il cliente, come la deduplica della sincronizzazione di oggi.
create table public.meta_daily (
  canale text not null default 'meta' check (canale in ('meta', 'google')),
  cliente_id text not null,
  campaign_id text not null,
  data date not null,
  spesa double precision not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr double precision not null default 0,
  cpc double precision not null default 0,
  cpm double precision not null default 0,
  lead double precision not null default 0,
  clic_link integer not null default 0,
  primary key (canale, cliente_id, campaign_id, data),
  posizione bigint generated always as identity
);
create index meta_daily_cliente_data on public.meta_daily (cliente_id, data);
create index meta_daily_data on public.meta_daily (data);

-- ───────────────────────── Risultati inseriti a mano ─────────────────────────

-- Risultati commerciali per tipo di campagna. `periodo` è un mese (AAAA-MM) o il lunedì di una
-- settimana (AAAA-MM-GG). Si compilano a mano: da qui in avanti dall'editor di tabelle di Supabase.
create table public.risultati_commerciali (
  id bigint generated always as identity primary key,
  periodo text not null check (periodo ~ '^\d{4}-\d{2}(-\d{2})?$'),
  cliente_id text not null references public.clienti (cliente_id) on delete cascade,
  sede_id text not null default '',
  tipo_campagna text not null default '',
  richieste double precision not null default 0,
  appuntamenti_fissati double precision not null default 0,
  appuntamenti_effettuati double precision not null default 0,
  vendite double precision not null default 0,
  fatturato double precision not null default 0
);
create index risultati_commerciali_cliente_sede on public.risultati_commerciali (cliente_id, sede_id, periodo);

create table public.risultati_venditori (
  id bigint generated always as identity primary key,
  mese text not null check (mese ~ '^\d{4}-\d{2}$'),
  sede_id text not null,
  venditore_id text not null references public.venditori (venditore_id) on delete cascade,
  appuntamenti_fissati double precision not null default 0,
  vendite double precision not null default 0,
  fatturato double precision not null default 0
);
create index risultati_venditori_sede_mese on public.risultati_venditori (sede_id, mese);

-- ───────────────────────── Attività, tappe e meeting ─────────────────────────

create table public.attivita_cliente (
  attivita_id text primary key,
  cliente_id text not null references public.clienti (cliente_id) on delete cascade,
  prodotto_id text not null default '',
  task_id text not null default '',
  blocco text not null default '',
  fase text not null default '',
  descrizione text not null default '',
  assegnatari text[] not null default '{}',
  tipo text not null default '',
  data_inizio date not null,
  data_fine date not null,
  stato text not null default 'todo' check (stato in ('todo', 'wip', 'done', 'blocked')),
  nota_team text not null default '',
  ordine integer not null default 0,
  posizione bigint generated always as identity
);
create index attivita_cliente_cliente on public.attivita_cliente (cliente_id);
create index attivita_cliente_scadenza on public.attivita_cliente (data_fine) where stato <> 'done';

create table public.fasi_completate (
  cliente_id text not null references public.clienti (cliente_id) on delete cascade,
  fase text not null,
  completata_il date not null,
  primary key (cliente_id, fase),
  posizione bigint generated always as identity
);

create table public.meeting_cliente (
  meeting_id text primary key,
  cliente_id text not null references public.clienti (cliente_id) on delete cascade,
  data date not null,
  titolo text not null default '',
  sentiment text not null default '',
  aggiornato_il timestamptz not null default now(),
  -- Il report del meeting così com'è stato estratto e rivisto (MeetingDataLoose).
  dati jsonb not null default '{}'::jsonb,
  posizione bigint generated always as identity
);
create index meeting_cliente_cliente_data on public.meeting_cliente (cliente_id, data desc);

-- ───────────────────────── Prospect e report commerciali ─────────────────────────

create table public.prospect (
  prospect_id text primary key,
  ragione_sociale text not null,
  nome_contatto text not null default '',
  tipo_business text not null default '',
  fatturato text not null default '',
  sedi text not null default '',
  email text not null default '',
  commerciale_id text not null default '',
  attivo boolean not null default true,
  creato_il timestamptz not null default now(),
  drive_folder_url text not null default '',
  media_budget_mensile double precision,
  target_cpl double precision,
  target_cpa_appuntamento double precision,
  target_lead_settimana double precision,
  target_appuntamenti_settimana double precision,
  target_fatturato_mensile double precision,
  target_margine_vendita_pct double precision,
  -- Valorizzati quando il prospect diventa cliente o viene proposto per la conversione.
  cliente_id text not null default '',
  consulente_suggerito_id text not null default '',
  calcolatore_budget jsonb,
  posizione bigint generated always as identity
);
create index prospect_commerciale on public.prospect (commerciale_id);

create table public.report_commerciale (
  report_id text primary key,
  prospect_id text not null references public.prospect (prospect_id) on delete cascade,
  commerciale_id text not null default '',
  data date not null,
  aggiornato_il timestamptz not null default now(),
  -- Il report della chiamata così com'è stato estratto e rivisto (ReportCommercialeDataLoose).
  dati jsonb not null default '{}'::jsonb,
  posizione bigint generated always as identity
);
create index report_commerciale_prospect on public.report_commerciale (prospect_id, data desc);

-- ───────────────────────── Sicurezza ─────────────────────────

alter table public.consulenti enable row level security;
alter table public.commerciali enable row level security;
alter table public.prodotti enable row level security;
alter table public.template_attivita enable row level security;
alter table public.clienti enable row level security;
alter table public.sedi enable row level security;
alter table public.ghl_connessioni enable row level security;
alter table public.connessioni_canale enable row level security;
alter table public.categorie_commerciali enable row level security;
alter table public.venditori enable row level security;
alter table public.campagne enable row level security;
alter table public.storico_stato_campagne enable row level security;
alter table public.meta_daily enable row level security;
alter table public.risultati_commerciali enable row level security;
alter table public.risultati_venditori enable row level security;
alter table public.attivita_cliente enable row level security;
alter table public.fasi_completate enable row level security;
alter table public.meeting_cliente enable row level security;
alter table public.prospect enable row level security;
alter table public.report_commerciale enable row level security;
