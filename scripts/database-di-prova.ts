/**
 * Database di prova: una copia in memoria del database vero, raggiungibile solo da questa macchina.
 * Serve a provare l'app in locale — schermate, salvataggi, accessi — senza toccare i dati veri: tutto
 * ciò che viene scritto qui sparisce quando lo script si ferma.
 *
 *   npx tsx --env-file=.env.local --tsconfig ./tsconfig.json scripts/database-di-prova.ts
 *
 * Lo script resta in ascolto finché non lo si chiude (Ctrl+C). In un altro terminale si avvia l'app
 * puntandola al database di prova:
 *
 *   bash:        ARCHIVIO_DATI=database DATABASE_URL=postgresql://prova:prova@127.0.0.1:54329/postgres npm run dev
 *   PowerShell:  $env:ARCHIVIO_DATI='database'; $env:DATABASE_URL='postgresql://prova:prova@127.0.0.1:54329/postgres'; npm run dev
 *
 * Cosa fa:
 *   - crea un Postgres in memoria con lo schema di supabase/migrations (le stesse migrazioni del vero);
 *   - copia i dati dal database vero (DATABASE_URL di .env.local), in sola lettura: su quello non scrive mai;
 *   - se al database vero manca una colonna che il codice conosce già (una migrazione scritta ma non
 *     ancora applicata), la salta e lo dice: nella copia quella colonna prende il suo valore
 *     predefinito. Così si può provare il codice nuovo PRIMA di toccare lo schema del vero;
 *   - NON copia le password di consulenti e commerciali: al loro posto mette password di prova
 *     ("prova-<id>" per un consulente, "prova-comm-<id>" per un commerciale), così in locale si può
 *     entrare come chiunque senza conoscere le password vere.
 *
 * Opzioni: --vuoto (solo lo schema, nessun dato), --porta=54329.
 */
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { apriPgliteConSchema } from "@/lib/db/inMemoria";
import { apriDatabase, collegamentoLocale, leggiStringaConnessione, urlDatabase } from "@/lib/db/postgres";
import { TABELLE, sqlInserimento, sqlLettura, type RigaTabella, type Tabella } from "@/lib/db/tabelle";
import type { Sessione } from "@/lib/db/tipi";

const RIGHE_PER_LOTTO = 1000;

function passwordDiProva(tabella: string, riga: RigaTabella): RigaTabella {
  if (tabella === "consulenti") return { ...riga, password: `prova-${riga.consulente_id}` };
  if (tabella === "commerciali") return { ...riga, password: `prova-comm-${riga.commerciale_id}` };
  return riga;
}

async function copiaDalVero(prova: Sessione): Promise<void> {
  const url = urlDatabase();
  if (collegamentoLocale(leggiStringaConnessione(url).host)) {
    throw new Error("DATABASE_URL punta già a un database locale: per la copia serve quello vero (avvia lo script con --env-file=.env.local).");
  }
  const vero = apriDatabase(url, { massimoConnessioni: 1 });
  try {
    // Una transazione di sola lettura: qualunque scrittura sul database vero verrebbe rifiutata da Postgres stesso.
    await vero.transazione(async (tx) => {
      await tx.script("set transaction read only");
      const colonneVere = new Map<string, Set<string>>();
      for (const c of await tx.esegui<{ table_name: string; column_name: string }>("select table_name, column_name from information_schema.columns where table_schema = 'public'")) {
        if (!colonneVere.has(c.table_name)) colonneVere.set(c.table_name, new Set());
        colonneVere.get(c.table_name)?.add(c.column_name);
      }
      for (const t of TABELLE) {
        const presenti = colonneVere.get(t.nome) ?? new Set<string>();
        const mancanti = t.colonne.filter((c) => !presenti.has(c.nome)).map((c) => c.nome);
        if (mancanti.length > 0) console.log(`  (${t.nome}: nel database vero manca ancora ${mancanti.join(", ")} — migrazione da applicare)`);
        const daLeggere: Tabella = { ...t, colonne: t.colonne.filter((c) => presenti.has(c.nome)) };
        const righe = (await tx.esegui(sqlLettura(daLeggere))).map((r) => passwordDiProva(t.nome, r));
        for (let i = 0; i < righe.length; i += RIGHE_PER_LOTTO) {
          await prova.esegui(sqlInserimento(t), [JSON.stringify(righe.slice(i, i + RIGHE_PER_LOTTO))]);
        }
        console.log(`  ${t.nome.padEnd(24)} ${righe.length}`);
      }
    });
  } finally {
    await vero.chiudi();
  }
}

async function main() {
  const vuoto = process.argv.includes("--vuoto");
  const porta = Number(process.argv.find((a) => a.startsWith("--porta="))?.split("=")[1] ?? 54329);

  const { pg, db } = await apriPgliteConSchema();
  if (vuoto) {
    console.log("Database di prova vuoto (solo lo schema).");
  } else {
    console.log("Copio i dati dal database vero (sola lettura):");
    await copiaDalVero(db);
  }

  const server = new PGLiteSocketServer({ db: pg, port: porta, host: "127.0.0.1" });
  await server.start();
  console.log(`\nDatabase di prova in ascolto su 127.0.0.1:${porta}. Per usarlo:`);
  console.log(`  ARCHIVIO_DATI=database DATABASE_URL=postgresql://prova:prova@127.0.0.1:${porta}/postgres npm run dev`);
  console.log("Ctrl+C per chiuderlo: i dati di prova spariscono.");

  const chiudi = async () => {
    await server.stop().catch(() => {});
    await pg.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", chiudi);
  process.on("SIGTERM", chiudi);
}

main().catch((e) => {
  console.error(`ERRORE: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
