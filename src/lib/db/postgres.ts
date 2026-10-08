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
 * Vero se il database sta su questa stessa macchina: è il database di prova in memoria
 * (scripts/database-di-prova.ts), mai quello vero. Lì non c'è cifratura da chiedere e c'è una sola
 * connessione disponibile.
 */
export function collegamentoLocale(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Lascia girare insieme al massimo `massimo` lavori; gli altri aspettano il loro turno, in ordine di
 * arrivo. Un lavoro che fallisce libera comunque il suo posto.
 */
export function limitatore(massimo: number): <T>(lavoro: () => Promise<T>) => Promise<T> {
  let liberi = massimo;
  const inAttesa: (() => void)[] = [];
  return async (lavoro) => {
    if (liberi > 0) liberi--;
    else await new Promise<void>((tocca) => inAttesa.push(tocca));
    try {
      return await lavoro();
    } finally {
      const prossimo = inAttesa.shift();
      // Il posto passa direttamente a chi aspetta, senza tornare libero: nessuno può infilarsi in mezzo.
      if (prossimo) prossimo();
      else liberi++;
    }
  };
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
 * Mai più richieste in corso che connessioni: lo garantisce `limitatore`. Di suo postgres.js, quando
 * le richieste superano le connessioni, ne manda diverse di fila sulla stessa connessione senza
 * aspettare la risposta alla precedente; il pooler di Supabase risponde alle prime due e lascia le
 * altre appese per sempre (verificato il 07/10/2026: una connessione, dodici letture insieme, due
 * risposte). Una pagina dell'app ne fa una decina insieme, quindi senza limite resterebbe a caricare.
 * Con il limite ogni richiesta ha la sua connessione e le altre aspettano: trenta letture su tre
 * connessioni in 0,7 secondi.
 * L'opzione del driver che spegne quell'accodamento (`max_pipeline: 0`) NON va usata: rompe
 * `sql.begin`, cioè ogni transazione ("Cannot read properties of undefined (reading 'queue')").
 *
 * Una transazione occupa un posto del limitatore dall'inizio alla fine, e dentro lavora sulla sua
 * connessione: il codice di una transazione deve usare solo la sessione che riceve (`tx`), una
 * query alla volta. Se usasse il collegamento generale aspetterebbe un posto che lei stessa occupa.
 *
 * Fa eccezione il database di prova in locale (vedi `collegamentoLocale`): senza cifratura e con una
 * sola connessione, perché è un Postgres in memoria che ne serve una per volta.
 */
export function apriDatabase(url: string, opzioni: { massimoConnessioni?: number } = {}): Database {
  const parametri = leggiStringaConnessione(url);
  const locale = collegamentoLocale(parametri.host);
  const massimo = locale ? 1 : (opzioni.massimoConnessioni ?? 5);
  const sql = postgres({
    ...parametri,
    ssl: locale ? false : "require",
    prepare: false,
    max: massimo,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
  const unaAllaVoltaPerConnessione = limitatore(massimo);

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

  const libera = sessione(sql);
  return {
    esegui: (testo, parametri) => unaAllaVoltaPerConnessione(() => libera.esegui(testo, parametri)),
    script: (testo) => unaAllaVoltaPerConnessione(() => libera.script(testo)),
    transazione: (lavoro) =>
      unaAllaVoltaPerConnessione(async () => (await sql.begin((tx) => lavoro(sessione(tx)))) as Awaited<ReturnType<typeof lavoro>>),
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
