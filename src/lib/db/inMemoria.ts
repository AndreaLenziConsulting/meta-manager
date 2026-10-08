import path from "path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { applicaMigrazioni, elencoMigrazioni } from "@/lib/db/migrazioni";
import type { Database, Esegui, Riga, Sessione } from "@/lib/db/tipi";

const CARTELLA_MIGRAZIONI = path.join(process.cwd(), "supabase", "migrations");

/**
 * Un database Postgres vero, in memoria (PGlite), con lo schema dell'app già creato: applica in
 * ordine i file di supabase/migrations con la stessa procedura usata sul database reale
 * (applicaMigrazioni). Serve ai test e alla prova della copia dei dati: se una migrazione ha un
 * errore o una query non regge lo schema, lo si scopre qui, non in produzione.
 *
 * Solo per test e script: non va importato dal codice che gira su Vercel (PGlite è una dipendenza
 * di sviluppo).
 */
export async function apriDatabaseInMemoria(cartellaMigrazioni = CARTELLA_MIGRAZIONI): Promise<Database> {
  return (await apriPgliteConSchema(cartellaMigrazioni)).db;
}

/** Come apriDatabaseInMemoria, ma restituisce anche il motore PGlite: serve a chi deve esporlo su una
 * porta locale (scripts/database-di-prova.ts). */
export async function apriPgliteConSchema(cartellaMigrazioni = CARTELLA_MIGRAZIONI): Promise<{ pg: PGlite; db: Database }> {
  const pg = new PGlite();

  const sessione = (cliente: PGlite | Transaction): Sessione => {
    const esegui: Esegui = async <T extends Riga = Riga>(testo: string, parametri: unknown[] = []) => (await cliente.query<T>(testo, parametri)).rows;
    return {
      esegui,
      script: async (testo) => {
        await cliente.exec(testo);
      },
    };
  };

  const db: Database = {
    ...sessione(pg),
    transazione: async (lavoro) => (await pg.transaction((tx) => lavoro(sessione(tx)))) as Awaited<ReturnType<typeof lavoro>>,
    chiudi: () => pg.close(),
  };
  await applicaMigrazioni(db, elencoMigrazioni(cartellaMigrazioni));
  return { pg, db };
}
