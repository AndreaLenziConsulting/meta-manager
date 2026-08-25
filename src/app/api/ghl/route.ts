import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti, getGhlConnessioni, getSedi } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { fetchAppuntamenti, fetchOpportunita, riepilogoAppuntamenti, riepilogoOpportunita } from "@/lib/ghl";
import type { GhlRiepilogoResponse } from "@/types/ghl";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Riepilogo "vendite e appuntamenti" da GHL/Squadd per una sede — Fase 1, sola lettura. Mai sul
 * link pubblico cliente (nessun ramo `code`, a differenza di /api/kpi): dato non ancora validato
 * quanto il Funnel, resta un pannello solo per il team — vedi src/lib/ghl.ts. Se la sede non ha
 * una GhlConnessione attiva, torna { connesso: false } con status 200 (non è un errore, è lo
 * stato normale finché nessuno l'ha collegata).
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clienteId = searchParams.get("clienteId");
  const sedeIdParam = searchParams.get("sedeId");
  const da = searchParams.get("da") || `${meseCorrente()}-01`;
  const a = searchParams.get("a") || new Date().toISOString().slice(0, 10);

  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }
  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  const tutteLeSedi = await getSedi();
  const sediCliente = tutteLeSedi.filter((s) => s.clienteId === clienteId && s.attivo);
  if (sediCliente.length === 0) {
    return NextResponse.json({ error: "Nessuna sede attiva per questo cliente" }, { status: 404 });
  }
  const sede = (sedeIdParam && sediCliente.find((s) => s.sedeId === sedeIdParam)) || sediCliente[0];

  const connessioni = await getGhlConnessioni();
  const connessione = connessioni.find((c) => c.sedeId === sede.sedeId && c.attivo);
  if (!connessione) {
    const risposta: GhlRiepilogoResponse = { connesso: false };
    return NextResponse.json(risposta);
  }

  const startMs = new Date(`${da}T00:00:00Z`).getTime();
  const endMs = new Date(`${a}T23:59:59Z`).getTime();

  try {
    const [appuntamenti, opportunitaVinte] = await Promise.all([
      fetchAppuntamenti(connessione.locationId, connessione.privateToken, connessione.calendarIds, startMs, endMs),
      fetchOpportunita(connessione.locationId, connessione.privateToken, { status: "won" }),
    ]);
    const risposta: GhlRiepilogoResponse = {
      connesso: true,
      calendariConfigurati: connessione.calendarIds.length > 0,
      appuntamenti: riepilogoAppuntamenti(appuntamenti, startMs, endMs),
      opportunita: riepilogoOpportunita(opportunitaVinte, startMs, endMs),
    };
    return NextResponse.json(risposta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore dal collegamento GHL: ${msg}` }, { status: 502 });
  }
}
