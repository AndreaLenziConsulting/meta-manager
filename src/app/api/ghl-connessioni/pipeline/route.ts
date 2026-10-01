import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getGhlConnessioni } from "@/lib/sheets";
import { fetchPipeline } from "@/lib/ghl";

export const runtime = "nodejs";

/**
 * Elenco delle pipeline di una connessione GHL già salvata (01/10/2026) — gemello di
 * /api/ghl-connessioni/calendari: usa il token memorizzato lato server, mai esposto al browser, solo
 * admin. Serve a due selettori di ModificaClienteModal.tsx: "quali pipeline appartengono a questa
 * sede" (per `connessioneId`) e "quale pipeline definisce questo cluster" (per `sedeId`, la
 * connessione attiva della sede — una categoria commerciale conosce la sua sede, non la connessione).
 * Una sede senza connessione attiva torna un elenco vuoto, non un errore: il selettore del cluster
 * semplicemente non compare.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può vedere le pipeline GHL" }, { status: 403 });
  }

  const connessioneId = req.nextUrl.searchParams.get("connessioneId");
  const sedeId = req.nextUrl.searchParams.get("sedeId");
  if (!connessioneId && !sedeId) {
    return NextResponse.json({ error: "connessioneId o sedeId mancante" }, { status: 400 });
  }

  const connessioni = await getGhlConnessioni();
  const connessione = connessioneId
    ? connessioni.find((c) => c.connessioneId === connessioneId)
    : connessioni.find((c) => c.sedeId === sedeId && c.attivo);
  if (!connessione) {
    if (sedeId) return NextResponse.json({ pipeline: [], pipelineIdsSede: [] });
    return NextResponse.json({ error: "Connessione GHL non trovata" }, { status: 404 });
  }

  try {
    const pipeline = await fetchPipeline(connessione.locationId, connessione.privateToken);
    return NextResponse.json({ pipeline, pipelineIdsSede: connessione.pipelineIds ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore dal collegamento GHL: ${msg}` }, { status: 502 });
  }
}
