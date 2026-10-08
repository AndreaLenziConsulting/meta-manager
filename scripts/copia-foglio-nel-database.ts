/**
 * Copia una tantum dei dati dal foglio Google al database Postgres (Supabase).
 *
 *   Prova, senza toccare nulla di reale (database in memoria, creato dalle migrazioni):
 *     npx tsx --env-file=.env.local --tsconfig ./tsconfig.json scripts/copia-foglio-nel-database.ts --prova
 *
 *   Copia vera, nel database indicato da DATABASE_URL (in .env.local):
 *     npx tsx --env-file=.env.local --tsconfig ./tsconfig.json scripts/copia-foglio-nel-database.ts
 *
 *   Su un database che ha già dati si ferma. Per svuotarlo e riscriverlo da capo: aggiungere --sovrascrivi.
 *   ATTENZIONE: dopo il passaggio dell'app al database, --sovrascrivi cancellerebbe ciò che l'app vi ha
 *   scritto nel frattempo. Serve solo prima del passaggio.
 *
 * Il foglio viene solo letto. Non stampa mai password, token o codici di accesso: solo conteggi.
 */
import {
  getAttivitaCliente,
  getCampagne,
  getCategorieCommerciali,
  getClienti,
  getCommerciali,
  getConnessioniCanale,
  getConsulenti,
  getCredenzialiAccesso,
  getFasiCompletate,
  getGhlConnessioni,
  getMeetingCliente,
  getMetaDaily,
  getProdotti,
  getProspect,
  getReportCommerciale,
  getRisultatiCommerciali,
  getRisultatiVenditori,
  getSedi,
  getStoricoStatoCampagne,
  getTemplateAttivita,
  getVenditori,
} from "@/lib/sheets";
import { eseguiCopia, type DatiFoglio } from "@/lib/db/copiaDaFoglio";
import { apriDatabase, urlDatabase } from "@/lib/db/postgres";
import type { Database } from "@/lib/db/tipi";

async function leggiFoglio(): Promise<DatiFoglio> {
  const [
    consulenti,
    commerciali,
    credenziali,
    prodotti,
    templateAttivita,
    clienti,
    sedi,
    ghlConnessioni,
    connessioniCanale,
    categorieCommerciali,
    venditori,
    campagne,
    storicoStato,
    metaDaily,
    risultatiCommerciali,
    risultatiVenditori,
    attivita,
    fasiCompletate,
    meeting,
    prospect,
    reportCommerciale,
  ] = await Promise.all([
    getConsulenti(),
    getCommerciali(),
    getCredenzialiAccesso(),
    getProdotti(),
    getTemplateAttivita(),
    getClienti(),
    getSedi(),
    getGhlConnessioni(),
    getConnessioniCanale(),
    getCategorieCommerciali(),
    getVenditori(),
    getCampagne(),
    getStoricoStatoCampagne(),
    getMetaDaily(),
    getRisultatiCommerciali(),
    getRisultatiVenditori(),
    getAttivitaCliente(),
    getFasiCompletate(),
    getMeetingCliente(),
    getProspect(),
    getReportCommerciale(),
  ]);
  return {
    consulenti,
    commerciali,
    credenziali,
    prodotti,
    templateAttivita,
    clienti,
    sedi,
    ghlConnessioni,
    connessioniCanale,
    categorieCommerciali,
    venditori,
    campagne,
    storicoStato,
    metaDaily,
    risultatiCommerciali,
    risultatiVenditori,
    attivita,
    fasiCompletate,
    meeting,
    prospect,
    reportCommerciale,
  };
}

async function main() {
  const prova = process.argv.includes("--prova");
  const sovrascrivi = process.argv.includes("--sovrascrivi");

  console.log("Lettura del foglio Google…");
  const dati = await leggiFoglio();

  let db: Database;
  if (prova) {
    // Import dinamico: PGlite è una dipendenza di sviluppo, serve solo alla prova.
    const { apriDatabaseInMemoria } = await import("@/lib/db/inMemoria");
    db = await apriDatabaseInMemoria();
    console.log("PROVA: database in memoria, creato dalle migrazioni. Nulla di reale viene scritto.");
  } else {
    db = apriDatabase(urlDatabase(), { massimoConnessioni: 1 });
    console.log(`Copia nel database di DATABASE_URL${sovrascrivi ? " (lo svuoto e lo riscrivo)" : ""}.`);
  }

  try {
    const esito = await eseguiCopia(db, dati, { sovrascrivi });

    console.log("\nRighe scritte per tabella:");
    for (const [tabella, n] of Object.entries(esito.scritte)) console.log(`  ${tabella.padEnd(26)} ${String(n).padStart(6)}`);

    // Riscontro sui dati pubblicitari: stessa spesa totale e stesso intervallo di date del foglio.
    const [riscontro] = await db.esegui<{ spesa: number | null; dal: string | null; al: string | null }>(
      "select sum(spesa)::double precision as spesa, min(data)::text as dal, max(data)::text as al from public.meta_daily"
    );
    const spesaFoglio = dati.metaDaily.reduce((s, r) => s + r.spesa, 0);
    const spesaDatabase = Number(riscontro.spesa ?? 0);
    console.log(`\nSpesa totale: foglio ${spesaFoglio.toFixed(2)} · database ${spesaDatabase.toFixed(2)} · dal ${riscontro.dal} al ${riscontro.al}`);
    if (Math.abs(spesaFoglio - spesaDatabase) > 0.01) throw new Error("La spesa totale nel database non coincide con quella del foglio.");

    if (esito.avvisi.length > 0) {
      console.log("\nAggiustamenti fatti (nessuna riga persa):");
      for (const a of esito.avvisi) console.log(`  - ${a}`);
    }
    if (esito.scartate.length > 0) {
      console.log(`\nRighe NON copiate (${esito.scartate.length}):`);
      for (const s of esito.scartate) console.log(`  - ${s.tabella}: ${s.id} — ${s.motivo}`);
    } else {
      console.log("\nNessuna riga scartata.");
    }
    console.log(prova ? "\nProva riuscita." : "\nCopia riuscita.");
  } finally {
    await db.chiudi();
  }
}

main().catch((e) => {
  console.error(`\nERRORE: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
