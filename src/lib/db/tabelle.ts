/**
 * Le tabelle del database viste dal codice: per ognuna i nomi e i tipi delle colonne che l'app legge
 * e scrive (lo schema vero sta in supabase/migrations: qui c'è solo ciò che serve a costruire le query).
 *
 * Tutte le scritture passano i dati come UN parametro di testo JSON, convertito dal database
 * (`$1::text::jsonb` + `jsonb_to_recordset`): i tipi li dà la definizione della colonna, e ogni driver
 * (postgres.js in produzione, PGlite nei test) passa il parametro com'è, senza interpretarlo. Tutte
 * le letture restituiscono date e orari come testo ISO, gli stessi formati che l'app usava col foglio.
 */
export type RigaTabella = Record<string, unknown>;

export type Colonna = {
  nome: string;
  /** Tipo Postgres della colonna. */
  tipo: string;
  /** Colonna `text[]`: viaggia come elenco JSON e viene ricomposta in ordine. */
  lista?: boolean;
  /** Espressione SQL usata quando il valore manca (es. `now()` per una data di creazione vuota). */
  seAssente?: string;
};

export type Tabella = { nome: string; colonne: Colonna[]; /** Colonna che dà l'ordine di inserimento (vedi la migrazione): `posizione`, oppure `id`. */ ordine: string };

const testo = (nome: string): Colonna => ({ nome, tipo: "text" });
const numero = (nome: string): Colonna => ({ nome, tipo: "double precision" });
const intero = (nome: string): Colonna => ({ nome, tipo: "integer" });
const booleano = (nome: string): Colonna => ({ nome, tipo: "boolean" });

/** Le tabelle nell'ordine in cui vanno riempite: prima chi è puntato da una chiave esterna. */
export const TABELLE: Tabella[] = [
  { nome: "consulenti", ordine: "posizione", colonne: [testo("consulente_id"), testo("nome"), testo("password"), booleano("attivo"), testo("email")] },
  { nome: "commerciali", ordine: "posizione", colonne: [testo("commerciale_id"), testo("nome"), testo("password"), booleano("attivo"), testo("email")] },
  { nome: "prodotti", ordine: "posizione", colonne: [testo("prodotto_id"), testo("nome"), booleano("attivo"), intero("durata_settimane"), testo("note")] },
  {
    nome: "template_attivita",
    ordine: "posizione",
    colonne: [
      testo("prodotto_id"),
      testo("task_id"),
      testo("blocco"),
      testo("fase"),
      testo("descrizione"),
      { nome: "assegnatari", tipo: "text[]", lista: true },
      testo("tipo"),
      intero("settimana_inizio"),
      intero("settimana_fine"),
      testo("giorni_testo"),
      testo("nota"),
      intero("ordine"),
    ],
  },
  {
    nome: "clienti",
    ordine: "posizione",
    colonne: [
      testo("cliente_id"),
      testo("nome"),
      testo("access_code"),
      booleano("attivo"),
      testo("consulente_id"),
      booleano("mostra_tab_extra"),
      testo("prodotto_id"),
      { nome: "data_inizio_progetto", tipo: "date" },
      testo("email"),
      testo("logo_url"),
      testo("colore_primario"),
      testo("colore_secondario"),
      testo("font_personalizzato"),
      testo("drive_folder_url"),
      testo("landing_page_url"),
      testo("appuntamenti_file_url"),
      { nome: "funnels", tipo: "jsonb" },
    ],
  },
  {
    nome: "sedi",
    ordine: "posizione",
    colonne: [
      testo("sede_id"),
      testo("cliente_id"),
      testo("nome"),
      testo("ad_account_id"),
      numero("target_cpa"),
      numero("target_cpl"),
      testo("tipo_conversione_lead"),
      booleano("attivo"),
      numero("target_budget_mensile"),
      numero("target_lead_settimana"),
      numero("target_appuntamenti_settimana"),
      numero("target_fatturato_mensile"),
      booleano("tutte_le_campagne"),
    ],
  },
  {
    nome: "ghl_connessioni",
    ordine: "posizione",
    colonne: [
      testo("connessione_id"),
      testo("sede_id"),
      testo("location_id"),
      testo("private_token"),
      booleano("attivo"),
      testo("note"),
      { nome: "creata_il", tipo: "timestamptz", seAssente: "now()" },
      { nome: "calendar_ids", tipo: "text[]", lista: true },
      { nome: "pipeline_ids", tipo: "text[]", lista: true },
    ],
  },
  {
    nome: "connessioni_canale",
    ordine: "posizione",
    colonne: [
      testo("connessione_id"),
      testo("sede_id"),
      testo("canale"),
      testo("account_id"),
      testo("tipo_conversione_lead"),
      booleano("attivo"),
      testo("note"),
      { nome: "creata_il", tipo: "timestamptz", seAssente: "now()" },
    ],
  },
  {
    nome: "categorie_commerciali",
    ordine: "posizione",
    colonne: [
      testo("categoria_id"),
      testo("sede_id"),
      testo("nome"),
      testo("tag_ghl"),
      testo("pipeline_ghl"),
      booleano("attivo"),
      intero("ordine"),
      numero("target_budget_mensile"),
      numero("target_lead_settimana"),
      numero("target_appuntamenti_settimana"),
      numero("target_fatturato_mensile"),
    ],
  },
  {
    nome: "venditori",
    ordine: "posizione",
    colonne: [testo("venditore_id"), testo("sede_id"), testo("nome"), numero("capienza_appuntamenti_mensile"), booleano("attivo"), testo("ghl_user_id")],
  },
  {
    nome: "campagne",
    ordine: "posizione",
    colonne: [testo("canale"), testo("campaign_id"), testo("cliente_id"), testo("sede_id"), testo("nome_campagna"), testo("tipo_campagna"), testo("stato")],
  },
  {
    nome: "storico_stato_campagne",
    ordine: "id",
    colonne: [
      { nome: "cambiato_il", tipo: "timestamptz" },
      testo("campaign_id"),
      testo("cliente_id"),
      testo("nome_campagna"),
      testo("stato_precedente"),
      testo("stato_nuovo"),
    ],
  },
  {
    nome: "meta_daily",
    ordine: "posizione",
    colonne: [
      testo("canale"),
      testo("cliente_id"),
      testo("campaign_id"),
      { nome: "data", tipo: "date" },
      numero("spesa"),
      intero("impressions"),
      intero("clicks"),
      numero("ctr"),
      numero("cpc"),
      numero("cpm"),
      numero("lead"),
      intero("clic_link"),
    ],
  },
  {
    nome: "risultati_commerciali",
    ordine: "id",
    colonne: [
      testo("periodo"),
      testo("cliente_id"),
      testo("sede_id"),
      testo("tipo_campagna"),
      numero("richieste"),
      numero("appuntamenti_fissati"),
      numero("appuntamenti_effettuati"),
      numero("vendite"),
      numero("fatturato"),
    ],
  },
  {
    nome: "risultati_venditori",
    ordine: "id",
    colonne: [testo("mese"), testo("sede_id"), testo("venditore_id"), numero("appuntamenti_fissati"), numero("vendite"), numero("fatturato")],
  },
  {
    nome: "attivita_cliente",
    ordine: "posizione",
    colonne: [
      testo("attivita_id"),
      testo("cliente_id"),
      testo("prodotto_id"),
      testo("task_id"),
      testo("blocco"),
      testo("fase"),
      testo("descrizione"),
      { nome: "assegnatari", tipo: "text[]", lista: true },
      testo("tipo"),
      { nome: "data_inizio", tipo: "date" },
      { nome: "data_fine", tipo: "date" },
      testo("stato"),
      testo("nota_team"),
      intero("ordine"),
    ],
  },
  { nome: "fasi_completate", ordine: "posizione", colonne: [testo("cliente_id"), testo("fase"), { nome: "completata_il", tipo: "date" }] },
  {
    nome: "meeting_cliente",
    ordine: "posizione",
    colonne: [
      testo("meeting_id"),
      testo("cliente_id"),
      { nome: "data", tipo: "date" },
      testo("titolo"),
      testo("sentiment"),
      { nome: "aggiornato_il", tipo: "timestamptz", seAssente: "now()" },
      { nome: "dati", tipo: "jsonb" },
    ],
  },
  {
    nome: "prospect",
    ordine: "posizione",
    colonne: [
      testo("prospect_id"),
      testo("ragione_sociale"),
      testo("nome_contatto"),
      testo("tipo_business"),
      testo("fatturato"),
      testo("sedi"),
      testo("email"),
      testo("commerciale_id"),
      booleano("attivo"),
      { nome: "creato_il", tipo: "timestamptz", seAssente: "now()" },
      testo("drive_folder_url"),
      numero("media_budget_mensile"),
      numero("target_cpl"),
      numero("target_cpa_appuntamento"),
      numero("target_lead_settimana"),
      numero("target_appuntamenti_settimana"),
      numero("target_fatturato_mensile"),
      numero("target_margine_vendita_pct"),
      testo("cliente_id"),
      testo("consulente_suggerito_id"),
      { nome: "calcolatore_budget", tipo: "jsonb" },
    ],
  },
  {
    nome: "report_commerciale",
    ordine: "posizione",
    colonne: [
      testo("report_id"),
      testo("prospect_id"),
      testo("commerciale_id"),
      { nome: "data", tipo: "date" },
      { nome: "aggiornato_il", tipo: "timestamptz", seAssente: "now()" },
      { nome: "dati", tipo: "jsonb" },
    ],
  },
];

const PER_NOME = new Map(TABELLE.map((t) => [t.nome, t]));

export function tabella(nome: string): Tabella {
  const t = PER_NOME.get(nome);
  if (!t) throw new Error(`Tabella sconosciuta: ${nome}`);
  return t;
}

/** Come una colonna entra da un record JSON: le liste (`text[]`) arrivano come elenco JSON e vengono ricomposte in ordine. */
function valoreDaJson(c: Colonna, alias: string): string {
  const valore = c.lista
    ? `coalesce((select array_agg(e.v order by e.n) from jsonb_array_elements_text(${alias}.${c.nome}) with ordinality as e(v, n)), '{}')`
    : `${alias}.${c.nome}`;
  return c.seAssente ? `coalesce(${valore}, ${c.seAssente})` : valore;
}

function definizioneJson(colonne: Colonna[]): string {
  return colonne.map((c) => `${c.nome} ${c.lista ? "jsonb" : c.tipo}`).join(", ");
}

/**
 * `insert … select … from jsonb_to_recordset($1)`: un lotto di righe viaggia come un solo parametro
 * di testo JSON. Le righe entrano nell'ordine in cui stanno nel lotto (`with ordinality … order by`),
 * così l'ordine di inserimento — su cui si basano le letture dell'app — ricalca l'ordine del lotto.
 * `seEsiste` è la clausola `on conflict …` (per ignorare o aggiornare una riga che c'è già).
 */
export function sqlInserimento(t: Tabella, seEsiste = ""): string {
  const colonne = t.colonne.map((c) => c.nome).join(", ");
  const valori = t.colonne.map((c) => valoreDaJson(c, "x")).join(", ");
  return (
    `insert into public.${t.nome} (${colonne}) select ${valori} ` +
    `from rows from (jsonb_to_recordset($1::text::jsonb) as (${definizioneJson(t.colonne)})) with ordinality as x(${colonne}, riga_n) order by x.riga_n` +
    (seEsiste ? ` ${seEsiste}` : "")
  );
}

/**
 * `update … set <solo le colonne indicate> … where <chiave>`: i valori arrivano da un record JSON
 * (`$1`), quindi con i tipi giusti e senza dipendere dal driver. `returning 1` permette a chi chiama
 * di sapere quante righe ha toccato.
 */
export function sqlAggiornamento(t: Tabella, chiave: string[], daImpostare: string[]): string {
  const coinvolte = t.colonne.filter((c) => chiave.includes(c.nome) || daImpostare.includes(c.nome));
  const set = t.colonne
    .filter((c) => daImpostare.includes(c.nome))
    .map((c) => `${c.nome} = ${valoreDaJson(c, "x")}`)
    .join(", ");
  const dove = chiave.map((k) => `t.${k} = x.${k}`).join(" and ");
  return `update public.${t.nome} as t set ${set} from jsonb_to_record($1::text::jsonb) as x(${definizioneJson(coinvolte)}) where ${dove} returning 1 as ok`;
}

/** L'espressione con cui una colonna viene letta: date e orari escono come testo ISO. */
function espressioneLettura(c: Colonna): string {
  if (c.tipo === "date") return `to_char(${c.nome}, 'YYYY-MM-DD') as ${c.nome}`;
  if (c.tipo === "timestamptz") return `to_char(${c.nome} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ${c.nome}`;
  return c.nome;
}

/** `select` di tutte le colonne note di una tabella, nell'ordine di inserimento. */
export function sqlLettura(t: Tabella, dove = ""): string {
  return `select ${t.colonne.map(espressioneLettura).join(", ")} from public.${t.nome}${dove ? ` where ${dove}` : ""} order by ${t.ordine}`;
}
