/**
 * Applica al database di DATABASE_URL (in .env.local) le migrazioni di supabase/migrations non ancora
 * applicate. Si può rilanciare quante volte si vuole: ciò che è già applicato viene saltato.
 *
 *   npx tsx --env-file=.env.local --tsconfig ./tsconfig.json scripts/applica-migrazioni.ts
 *
 * Aggiungere --elenco per vedere cosa farebbe, senza fare nulla.
 */
import path from "path";
import { applicaMigrazioni, elencoMigrazioni } from "@/lib/db/migrazioni";
import { apriDatabase, urlDatabase } from "@/lib/db/postgres";

async function main() {
  const soloElenco = process.argv.includes("--elenco");
  const migrazioni = elencoMigrazioni(path.join(process.cwd(), "supabase", "migrations"));
  const db = apriDatabase(urlDatabase(), { massimoConnessioni: 1 });
  try {
    if (soloElenco) {
      const esiste = await db.esegui<{ c: number }>("select count(*)::int as c from information_schema.tables where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'");
      const applicate = esiste[0].c > 0 ? new Set((await db.esegui<{ version: string }>("select version from supabase_migrations.schema_migrations")).map((r) => r.version)) : new Set<string>();
      for (const m of migrazioni) console.log(`${applicate.has(m.versione) ? "già applicata" : "DA APPLICARE "}  ${m.versione}  ${m.nome}`);
      return;
    }
    const applicate = await applicaMigrazioni(db, migrazioni);
    if (applicate.length === 0) console.log("Nessuna migrazione da applicare: il database è già aggiornato.");
    for (const m of applicate) console.log(`Applicata ${m.versione}  ${m.nome}`);
  } finally {
    await db.chiudi();
  }
}

main().catch((e) => {
  console.error(`ERRORE: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
