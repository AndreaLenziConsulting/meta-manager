import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienteByAccessCode, getClienti, getSedi } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { fetchFrequenzaPerCampagna } from "@/lib/meta";
import type { Sede } from "@/types/kpi";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Ultimo giorno di calendario (YYYY-MM-DD) del mese `mese` (YYYY-MM) — stesso trucco già in uso in lib/kpi.ts/api/ghl/route.ts. */
function ultimoGiornoDelMese(mese: string): string {
  const [anno, m] = mese.split("-").map(Number);
  return new Date(Date.UTC(anno, m, 1) - 1).toISOString().slice(0, 10);
}

/**
 * Frequenza per campagna (blocco 7 del redesign KPI), letta LIVE sull'intero periodo richiesto —
 * mai sincronizzata/salvata nel foglio insieme al resto di MetaDaily, vedi il commento su
 * fetchFrequenzaPerCampagna in lib/meta.ts (reach non è sommabile/mediabile su righe giornaliere).
 * Stesso schema di autenticazione di /api/kpi (ramo `code` pubblico o sessione+clienteId interna).
 * Resiliente: se Meta non risponde, 200 con mappa vuota — mai un errore che rompe il resto della
 * pagina (la colonna Frequenza mostra "dato non disponibile", quella campagna non contribuisce
 * alla regola frequenza-alta del blocco 4/7, mai un falso verde).
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
    return NextResponse.json({ frequenzaPerCampagna: {} });
  }

  const since = `${da}-01`;
  const until = ultimoGiornoDelMese(a);

  try {
    const mappa = await fetchFrequenzaPerCampagna(sede.adAccountId, since, until);
    return NextResponse.json({ frequenzaPerCampagna: Object.fromEntries(mappa) });
  } catch {
    // Vedi il docblock sopra: mai un errore qui, la frequenza è un'informazione accessoria.
    return NextResponse.json({ frequenzaPerCampagna: {} });
  }
}
