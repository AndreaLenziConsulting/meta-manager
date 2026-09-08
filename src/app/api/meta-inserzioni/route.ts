import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienteByAccessCode, getClienti, getSedi } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { fetchInserzioniPerCampagna, fetchStatoInserzioni } from "@/lib/meta";
import type { Sede } from "@/types/kpi";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Ultimo giorno di calendario (YYYY-MM-DD) del mese `mese` (YYYY-MM) — stesso trucco già in uso in lib/kpi.ts/api/meta-frequenza/route.ts. */
function ultimoGiornoDelMese(mese: string): string {
  const [anno, m] = mese.split("-").map(Number);
  return new Date(Date.UTC(anno, m, 1) - 1).toISOString().slice(0, 10);
}

/**
 * Spesa+lead+stato per inserzione (ad), letti LIVE sull'intero periodo richiesto — mai
 * sincronizzati/salvati nel foglio, vedi il commento su fetchInserzioniPerCampagna in lib/meta.ts.
 * Ritorna i dati grezzi per inserzione: è il chiamante (KpiSection.tsx, useMemo con
 * trovaInserzioniOutlier) a decidere quali sono outlier rispetto al target CPL della sede — stesso
 * schema di /api/meta-frequenza (dati grezzi qui, soglia applicata lato client). Stessa
 * autenticazione di /api/kpi (ramo `code` pubblico o sessione+clienteId interna).
 *
 * Resiliente: se Meta non risponde, 200 con array vuoto — mai un errore che rompe il resto della
 * pagina (nessun avviso "inserzioni outlier" quel giro, mai un falso negativo mostrato come dato).
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const clienteIdParam = searchParams.get("clienteId");
  const sedeIdParam = searchParams.get("sedeId");
  const da = searchParams.get("da") || meseCorrente();
  const a = searchParams.get("a") || meseCorrente();

  let clienteId: string;

  if (code) {
    const cliente = await getClienteByAccessCode(code);
    if (!cliente || !cliente.attivo) {
      return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
    }
    clienteId = cliente.clienteId;
  } else {
    const sessione = await getSessione();
    if (!sessione) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (!clienteIdParam) {
      return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
    }
    const clienti = await getClienti();
    if (!puoVedereCliente(sessione, clienteIdParam, clienti)) {
      return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
    }
    clienteId = clienteIdParam;
  }

  const tutteLeSedi = await getSedi();
  const sediCliente = tutteLeSedi.filter((s) => s.clienteId === clienteId && s.attivo);
  if (sediCliente.length === 0) {
    return NextResponse.json({ error: "Nessuna sede attiva per questo cliente" }, { status: 404 });
  }
  const sede = (sedeIdParam && sediCliente.find((s: Sede) => s.sedeId === sedeIdParam)) || sediCliente[0];

  if (!sede.adAccountId) {
    return NextResponse.json({ inserzioni: [] });
  }

  const since = `${da}-01`;
  const until = ultimoGiornoDelMese(a);

  try {
    const [aggregate, stati] = await Promise.all([
      fetchInserzioniPerCampagna(sede.adAccountId, since, until, sede.tipoConversioneLead || undefined),
      fetchStatoInserzioni(sede.adAccountId),
    ]);
    const inserzioni = aggregate.map((i) => ({ ...i, stato: stati.get(i.adId) || "" }));
    return NextResponse.json({ inserzioni });
  } catch {
    // Vedi il docblock sopra: mai un errore qui, le inserzioni outlier sono un'informazione accessoria.
    return NextResponse.json({ inserzioni: [] });
  }
}
