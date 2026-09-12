import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaConnessioneCanale, getConnessioniCanale } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Elimina per sempre una connessione canale (Meta Ads/Google Ads) — solo admin, stessa gerarchia
 * di /api/ghl-connessioni/elimina. Non tocca alcun dato KPI storico: la connessione è solo la
 * configurazione (account id, tipoConversioneLead), riattivabile in un secondo momento.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare una connessione canale" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { connessioneId?: string };
  const { connessioneId } = body;
  if (!connessioneId) {
    return NextResponse.json({ error: "connessioneId obbligatorio" }, { status: 400 });
  }

  const connessioni = await getConnessioniCanale();
  if (!connessioni.some((c) => c.connessioneId === connessioneId)) {
    return NextResponse.json({ error: "Connessione non trovata" }, { status: 404 });
  }

  try {
    await eliminaConnessioneCanale(connessioneId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
