import { apriDatabase, urlDatabase } from "@/lib/db/postgres";
import type { Database } from "@/lib/db/tipi";

/**
 * Il collegamento al database usato dall'app: uno solo per istanza del server, aperto alla prima
 * richiesta che ne ha bisogno. Sta su `globalThis` così in sviluppo sopravvive al ricaricamento dei
 * moduli (altrimenti ogni modifica al codice ne aprirebbe uno nuovo, fino a esaurirli).
 */
const globale = globalThis as typeof globalThis & { __databaseMetaManager?: Database };

export function database(): Database {
  if (!globale.__databaseMetaManager) globale.__databaseMetaManager = apriDatabase(urlDatabase());
  return globale.__databaseMetaManager;
}

/** Sostituisce il collegamento: per i test (un Postgres in memoria) e per gli script. */
export function usaDatabase(db: Database | undefined): void {
  globale.__databaseMetaManager = db;
}
