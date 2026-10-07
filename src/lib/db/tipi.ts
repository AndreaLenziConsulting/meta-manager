/**
 * Accesso al database dell'app (Postgres su Supabase), ridotto a ciò che serve: eseguire una query
 * con i suoi parametri, dentro o fuori da una transazione. Chi scrive le query non sa quale driver
 * c'è sotto: in produzione è postgres.js (src/lib/db/postgres.ts), nei test e nella prova della copia
 * dei dati è PGlite, un Postgres vero che gira in memoria (src/lib/db/inMemoria.ts) — le stesse
 * query, lo stesso SQL delle migrazioni in supabase/migrations.
 */
export type Riga = Record<string, unknown>;

/** Esegue una query. I parametri sono posizionali ($1, $2…). */
export type Esegui = <T extends Riga = Riga>(sql: string, parametri?: unknown[]) => Promise<T[]>;

/** Ciò che si può fare sul database, dentro o fuori da una transazione. */
export type Sessione = {
  esegui: Esegui;
  /** Esegue un intero file SQL (più istruzioni, nessun parametro): serve alle migrazioni. */
  script: (sql: string) => Promise<void>;
};

export type Database = Sessione & {
  /** Tutto ciò che la funzione fa con la sessione ricevuta va a buon fine insieme, o niente. */
  transazione: <T>(lavoro: (tx: Sessione) => Promise<T>) => Promise<T>;
  chiudi: () => Promise<void>;
};
