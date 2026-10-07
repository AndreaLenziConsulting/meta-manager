import path from "path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { applicaMigrazioni, elencoMigrazioni } from "@/lib/db/migrazioni";
import type { Database, Esegui, Riga, Sessione } from "@/lib/db/tipi";

/**
 * Un database Postgres vero, in memoria (PGlite), con lo schema dell'app già creato: applica in
 * ordine i file di supabase/migrations con la stessa procedura usata sul database reale
 * (applicaMigrazioni). Serve ai test e alla prova della copia dei dati: se una migrazione ha un
 * errore o una query non regge lo schema, lo si scopre qui, non in produzione.
 *
 * Solo per test e script: non va importato dal codice che gira su Vercel (PGlite è una dipendenza
 * di sviluppo).
 */
export async function apriDatabaseInMemoria(cartellaMigrazioni = path.join(process.cwd(), "supabase", "migrations")): Promise<Database> {
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
  return db;
}
