import postgres from "postgres";
import type { Database, Esegui, Riga } from "@/lib/db/tipi";

/**
 * Collegamento al database Postgres di Supabase con postgres.js.
 *
 * `DATABASE_URL` è la stringa di connessione che Supabase mostra in "Connect". Va usata quella del
 * "Transaction pooler" (porta 6543): l'app gira su funzioni serverless, ognuna aprirebbe le sue
 * connessioni dirette e le esaurirebbe. Col pooler di transazione le istruzioni preparate non sono
 * disponibili, da cui `prepare: false`.
 *
 * `max` è basso apposta: ogni istanza serverless serve poche richieste per volta, e il limite vero
 * sta nel pooler.
 */
export function apriDatabase(url: string, opzioni: { massimoConnessioni?: number } = {}): Database {
  const sql = postgres(url, {
    prepare: false,
    max: opzioni.massimoConnessioni ?? 3,
    idle_timeout: 20,
    connect_timeout: 15,
    // Niente trasformazioni automatiche: colonne e valori arrivano come li scrive la query.
    onnotice: () => {},
  });

  const eseguiCon =
    (cliente: postgres.Sql | postgres.TransactionSql): Esegui =>
    async <T extends Riga = Riga>(testo: string, parametri: unknown[] = []) => {
      const righe = await cliente.unsafe(testo, parametri as postgres.ParameterOrJSON<never>[]);
      return righe as unknown as T[];
    };

  return {
    esegui: eseguiCon(sql),
    transazione: async (lavoro) => (await sql.begin((tx) => lavoro(eseguiCon(tx)))) as Awaited<ReturnType<typeof lavoro>>,
    chiudi: () => sql.end({ timeout: 5 }),
  };
}

/** La stringa di connessione del database, o un errore che dice cosa manca e dove metterlo. */
export function urlDatabase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Manca DATABASE_URL: la stringa di connessione del database Supabase ("Connect" → "Transaction pooler"), da mettere in .env.local e nelle variabili di Vercel.'
    );
  }
  return url;
}
