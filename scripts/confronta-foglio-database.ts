/**
 * Confronta ciò che l'app legge dal foglio Google con ciò che legge dal database, funzione per
 * funzione: stessi oggetti, stesso ordine. Serve dopo la copia (scripts/copia-foglio-nel-database.ts)
 * per avere la prova che, passando al database, l'app vede esattamente gli stessi dati.
 *
 *   npx tsx --env-file=.env.local --tsconfig ./tsconfig.json scripts/confronta-foglio-database.ts
 *
 * Solo letture, su entrambi. Non stampa valori (potrebbero essere password, token o codici di
 * accesso): di una differenza dice dove sta — funzione, posizione, identificativo, nome del campo.
 *
 * Differenza attesa e già tolta dal confronto: le righe che la copia scarta di proposito (es. la
 * connessione di una sede eliminata), elencate in fondo.
 */
import { isDeepStrictEqual } from "util";
import * as foglio from "@/lib/sheets";
import * as database from "@/lib/db/archivio";
import { database as collegamento } from "@/lib/db/connessione";

type Lettura = { nome: string; leggi: (da: typeof database) => Promise<unknown[]>; id: (x: Record<string, unknown>) => string };

const LETTURE: Lettura[] = [
  { nome: "getConsulenti", leggi: (a) => a.getConsulenti(), id: (x) => String(x.consulenteId) },
  { nome: "getCommerciali", leggi: (a) => a.getCommerciali(), id: (x) => String(x.commercialeId) },
  { nome: "getProdotti", leggi: (a) => a.getProdotti(), id: (x) => String(x.prodottoId) },
  { nome: "getTemplateAttivita", leggi: (a) => a.getTemplateAttivita(), id: (x) => `${x.prodottoId}/${x.taskId}` },
  { nome: "getClienti", leggi: (a) => a.getClienti(), id: (x) => String(x.clienteId) },
  { nome: "getSedi", leggi: (a) => a.getSedi(), id: (x) => String(x.sedeId) },
  { nome: "getGhlConnessioni", leggi: (a) => a.getGhlConnessioni(), id: (x) => String(x.connessioneId) },
  { nome: "getConnessioniCanale", leggi: (a) => a.getConnessioniCanale(), id: (x) => String(x.connessioneId) },
  { nome: "getCategorieCommerciali", leggi: (a) => a.getCategorieCommerciali(), id: (x) => String(x.categoriaId) },
  { nome: "getVenditori", leggi: (a) => a.getVenditori(), id: (x) => String(x.venditoreId) },
  { nome: "getRisultatiVenditori", leggi: (a) => a.getRisultatiVenditori(), id: (x) => `${x.venditoreId}/${x.mese}` },
  { nome: "getCampagne", leggi: (a) => a.getCampagne(), id: (x) => `${x.canale}/${x.campaignId}` },
  { nome: "getStoricoStatoCampagne", leggi: (a) => a.getStoricoStatoCampagne(), id: (x) => `${x.campaignId}/${x.cambiatoIl}` },
  {
    nome: "getUltimoCambioPerCampagna",
    leggi: async (a) => [...(await a.getUltimoCambioPerCampagna()).entries()].sort(([x], [y]) => x.localeCompare(y)).map(([campaignId, ultimo]) => ({ campaignId, ultimo })),
    id: (x) => String(x.campaignId),
  },
  { nome: "getMetaDaily", leggi: (a) => a.getMetaDaily(), id: (x) => `${x.clienteId}/${x.campaignId}/${x.data}` },
  { nome: "getRisultatiCommerciali", leggi: (a) => a.getRisultatiCommerciali(), id: (x) => `${x.clienteId}/${x.sedeId}/${x.periodo}` },
  { nome: "getAttivitaCliente", leggi: (a) => a.getAttivitaCliente(), id: (x) => String(x.attivitaId) },
  { nome: "getFasiCompletate", leggi: (a) => a.getFasiCompletate(), id: (x) => `${x.clienteId}/${x.fase}` },
  { nome: "getMeetingCliente", leggi: (a) => a.getMeetingCliente(), id: (x) => String(x.meetingId) },
  { nome: "getProspect", leggi: (a) => a.getProspect(), id: (x) => String(x.prospectId) },
  { nome: "getReportCommerciale", leggi: (a) => a.getReportCommerciale(), id: (x) => String(x.reportId) },
];

/** I nomi dei campi (anche annidati) in cui due oggetti differiscono. */
function campiDiversi(a: unknown, b: unknown, prefisso = ""): string[] {
  if (isDeepStrictEqual(a, b)) return [];
  const oggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  if (!oggetto(a) || !oggetto(b)) return [prefisso || "(valore)"];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => campiDiversi(a[k], b[k], prefisso ? `${prefisso}.${k}` : k));
}

async function main() {
  // Le righe che la copia scarta di proposito non devono risultare come differenze.
  const idSedi = new Set((await foglio.getSedi()).map((s) => s.sedeId));
  const attese: string[] = [];

  let diverse = 0;
  for (const l of LETTURE) {
    let dalFoglio = (await l.leggi(foglio as unknown as typeof database)) as Record<string, unknown>[];
    const dalDatabase = (await l.leggi(database)) as Record<string, unknown>[];
    if (l.nome === "getConnessioniCanale") {
      const orfane = dalFoglio.filter((c) => !idSedi.has(String(c.sedeId)));
      for (const o of orfane) attese.push(`connessione canale ${l.id(o)}: la sua sede non esiste più, non è stata copiata`);
      dalFoglio = dalFoglio.filter((c) => idSedi.has(String(c.sedeId)));
    }

    if (isDeepStrictEqual(dalFoglio, dalDatabase)) {
      console.log(`uguali    ${l.nome.padEnd(28)} ${String(dalFoglio.length).padStart(5)} righe`);
      continue;
    }
    diverse++;
    console.log(`DIVERSI   ${l.nome.padEnd(28)} foglio ${dalFoglio.length} righe · database ${dalDatabase.length} righe`);
    let mostrate = 0;
    for (let i = 0; i < Math.max(dalFoglio.length, dalDatabase.length) && mostrate < 5; i++) {
      const a = dalFoglio[i];
      const b = dalDatabase[i];
      if (isDeepStrictEqual(a, b)) continue;
      mostrate++;
      if (!a || !b) console.log(`            posizione ${i}: presente solo ${a ? "nel foglio" : "nel database"} (${l.id(a ?? b)})`);
      else if (l.id(a) !== l.id(b)) console.log(`            posizione ${i}: righe diverse (foglio ${l.id(a)} · database ${l.id(b)})`);
      else console.log(`            posizione ${i} (${l.id(a)}): campi diversi → ${campiDiversi(a, b).join(", ")}`);
    }
  }

  if (attese.length > 0) {
    console.log("\nDifferenze attese, tolte dal confronto:");
    for (const a of attese) console.log(`  - ${a}`);
  }
  console.log(diverse === 0 ? "\nIl database restituisce gli stessi dati del foglio." : `\n${diverse} letture restituiscono dati diversi.`);
  await collegamento().chiudi();
  if (diverse > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`ERRORE: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
