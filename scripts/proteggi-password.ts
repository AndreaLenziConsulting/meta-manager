/**
 * Converte le password di consulenti e commerciali ancora scritte in chiaro nel database nella loro
 * impronta (src/lib/password.ts): dopo, dal database non si possono più leggere.
 *
 *   npx tsx --env-file=.env.local --tsconfig ./tsconfig.json scripts/proteggi-password.ts --prova
 *   npx tsx --env-file=.env.local --tsconfig ./tsconfig.json scripts/proteggi-password.ts
 *
 * QUANDO: solo DOPO aver pubblicato la versione dell'app che riconosce le impronte (dall'08/10/2026).
 * La versione precedente confrontava le password così com'erano scritte: lanciarlo prima lascerebbe
 * fuori tutti i consulenti e i commerciali. La versione nuova accetta sia le impronte sia le password
 * ancora in chiaro, quindi fra la pubblicazione e questo script nessuno resta fuori.
 *
 * Si può rilanciare: chi ha già l'impronta viene saltato. Ogni conversione è verificata prima di
 * essere scritta (l'impronta deve corrispondere alla password da cui nasce) e tutto avviene in una
 * sola transazione: o si convertono tutte, o nessuna.
 *
 * Non stampa mai password né impronte: solo quante persone ha convertito. `--prova` dice cosa
 * farebbe, senza scrivere nulla.
 */
import { apriDatabase, collegamentoLocale, leggiStringaConnessione, urlDatabase } from "@/lib/db/postgres";
import { creaImpronta, eImpronta, verificaPassword } from "@/lib/password";

const TABELLE = [
  { tabella: "consulenti", chiave: "consulente_id", nome: "consulenti" },
  { tabella: "commerciali", chiave: "commerciale_id", nome: "commerciali" },
] as const;

async function main() {
  const prova = process.argv.includes("--prova");
  const url = urlDatabase();
  console.log(collegamentoLocale(leggiStringaConnessione(url).host) ? "Database di PROVA (locale)." : "Database VERO.");

  const db = apriDatabase(url, { massimoConnessioni: 1 });
  try {
    await db.transazione(async (tx) => {
      for (const t of TABELLE) {
        const righe = await tx.esegui<{ id: string; password: string }>(`select ${t.chiave} as id, password from public.${t.tabella} order by posizione`);
        const inChiaro = righe.filter((r) => r.password !== "" && !eImpronta(r.password));
        const senza = righe.filter((r) => r.password === "").length;
        console.log(`${t.nome}: ${righe.length} in tutto, ${righe.length - inChiaro.length - senza} già protette, ${inChiaro.length} da convertire, ${senza} senza password.`);
        if (prova) continue;
        for (const r of inChiaro) {
          const impronta = await creaImpronta(r.password);
          if (!(await verificaPassword(r.password, impronta))) throw new Error(`Impronta non verificata per ${t.nome}/${r.id}: nessuna modifica scritta.`);
          const esito = await tx.esegui(`update public.${t.tabella} set password = $1 where ${t.chiave} = $2 and password = $3 returning 1 as ok`, [impronta, r.id, r.password]);
          if (esito.length !== 1) throw new Error(`${t.nome}/${r.id}: la password è cambiata durante la conversione, nessuna modifica scritta. Rilancia lo script.`);
        }
        if (inChiaro.length > 0) console.log(`${t.nome}: ${inChiaro.length} convertite.`);
      }
    });
    console.log(prova ? "Prova: nessuna modifica scritta." : "Fatto.");
  } finally {
    await db.chiudi();
  }
}

main().catch((e) => {
  console.error(`ERRORE: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
