import postgres from "postgres";
import type { Database, Esegui, Riga, Sessione } from "@/lib/db/tipi";

export type ParametriConnessione = { host: string; port: number; database: string; username: string; password: string };

/**
 * Scompone la stringa di connessione (`postgresql://utente:password@host:porta/database`) nelle sue
 * parti, senza passare dal lettore di indirizzi standard.
 *
 * Motivo: chi incolla la password così com'è dentro la stringa (è ciò che Supabase invita a fare,
 * sostituendo `[YOUR-PASSWORD]`) può avere una password con `%`, `@`, `#`… che in un indirizzo
 * andrebbero codificati. Il lettore standard su un `%` isolato si rompe ("URI malformed"), e su un
 * `@` taglia nel punto sbagliato. Qui:
 *   - utente e password si separano al primo `:`, la password finisce all'ULTIMA `@`;
 *   - la password viene decodificata solo se è una codifica valida (es. `p%40ss` → `p@ss`);
 *     altrimenti vale così com'è scritta.
 */
export function leggiStringaConnessione(url: string): ParametriConnessione {
  const pulita = url.trim().replace(/^["']|["']$/g, "");
  const m = pulita.match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^@/:?]+)(?::(\d+))?\/([^?]+)(?:\?.*)?$/);
  if (!m) {
    throw new Error("DATABASE_URL non ha la forma postgresql://utente:password@host:porta/database.");
  }
  const [, utente, passwordGrezza, host, porta, database] = m;
  let password = passwordGrezza;
  try {
    password = decodeURIComponent(passwordGrezza);
  } catch {
    // Non è una codifica valida (un `%` scritto così com'è): la password è quella letterale.
  }
  return { host, port: porta ? Number(porta) : 5432, database: decodeURIComponent(database), username: decodeURIComponent(utente), password };
}

/**
 * Collegamento al database Postgres di Supabase con postgres.js.
 *
 * `DATABASE_URL` è la stringa di connessione che Supabase mostra in "Connect". Va usata quella del
 * "Transaction pooler" (porta 6543): l'app gira su funzioni serverless, ognuna aprirebbe le sue
 * connessioni dirette e le esaurirebbe. Col pooler di transazione le istruzioni preparate non sono
 * disponibili, da cui `prepare: false`.
 *
 * `max` è basso apposta: ogni istanza serverless serve poche richieste per volta, e il limite vero
 * sta nel pooler. La connessione è sempre cifrata (`ssl: "require"`).
 *
 * `max_pipeline: 0` è indispensabile. Di suo postgres.js, quando le richieste in corso sono più delle
 * connessioni, ne manda diverse di fila sulla stessa connessione senza aspettare la risposta alla
 * precedente; il pooler di Supabase risponde alle prime due e lascia le altre appese per sempre
 * (verificato il 07/10/2026: con una connessione e dodici letture insieme ne tornavano due). Con 0 ogni
 * connessione porta una richiesta alla volta e le altre aspettano il loro turno: trenta letture su
 * tre connessioni in 0,7 secondi. Una pagina dell'app ne fa una decina insieme, quindi senza questa
 * riga le pagine restano a caricare.
 */
export function apriDatabase(url: string, opzioni: { massimoConnessioni?: number } = {}): Database {
  // `max_pipeline` non compare nei tipi TypeScript di postgres.js ma il driver la legge (è fra le sue
  // opzioni predefinite, a 100): da qui la conversione di tipo.
  const opzioniDriver = {
    ...leggiStringaConnessione(url),
    ssl: "require",
    prepare: false,
    max_pipeline: 0,
    max: opzioni.massimoConnessioni ?? 5,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  };
  const sql = postgres(opzioniDriver as postgres.Options<Record<string, never>>);

  const eseguiCon =
    (cliente: postgres.Sql | postgres.TransactionSql): Esegui =>
    async <T extends Riga = Riga>(testo: string, parametri: unknown[] = []) => {
      const righe = await cliente.unsafe(testo, parametri as postgres.ParameterOrJSON<never>[]);
      return righe as unknown as T[];
    };

  // Senza parametri postgres.js usa il protocollo semplice, che accetta più istruzioni in un colpo.
  const sessione = (cliente: postgres.Sql | postgres.TransactionSql): Sessione => ({
    esegui: eseguiCon(cliente),
    script: async (testo) => {
      await cliente.unsafe(testo);
    },
  });

  return {
    ...sessione(sql),
    transazione: async (lavoro) => (await sql.begin((tx) => lavoro(sessione(tx)))) as Awaited<ReturnType<typeof lavoro>>,
    chiudi: () => sql.end({ timeout: 5 }),
  };
}

/** La stringa di connessione del database, o un errore che dice cosa manca e dove metterlo. */
export function urlDatabase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Manca DATABASE_URL: la stringa di connessione del database Supabase ("Connect" → "Direct" → "Transaction pooler"), da mettere in .env.local e nelle variabili di Vercel.'
    );
  }
  return url;
}
