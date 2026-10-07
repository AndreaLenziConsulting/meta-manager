import { readdirSync, readFileSync } from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import type { Database, Esegui, Riga } from "@/lib/db/tipi";

/**
 * Un database Postgres vero, in memoria (PGlite), con lo schema dell'app già creato: applica in
 * ordine i file di supabase/migrations, gli stessi che Supabase applica al database reale. Serve ai
 * test e alla prova della copia dei dati (scripts/copia-foglio-nel-database.ts --prova): se una
 * migrazione ha un errore o una query non regge lo schema, lo si scopre qui, non in produzione.
 *
 * Solo per test e script: non va importato dal codice che gira su Vercel (PGlite è una dipendenza
 * di sviluppo).
 */
export async function apriDatabaseInMemoria(cartellaMigrazioni = path.join(process.cwd(), "supabase", "migrations")): Promise<Database> {
  const pg = new PGlite();
  const file = readdirSync(cartellaMigrazioni)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of file) {
    await pg.exec(readFileSync(path.join(cartellaMigrazioni, f), "utf-8"));
  }

  const eseguiCon =
    (cliente: Pick<PGlite, "query">): Esegui =>
    async <T extends Riga = Riga>(testo: string, parametri: unknown[] = []) =>
      (await cliente.query<T>(testo, parametri)).rows;

  return {
    esegui: eseguiCon(pg),
    transazione: async (lavoro) => (await pg.transaction((tx) => lavoro(eseguiCon(tx as unknown as Pick<PGlite, "query">)))) as Awaited<ReturnType<typeof lavoro>>,
    chiudi: () => pg.close(),
  };
}
