import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaGhlConnessione, getGhlConnessioni } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Elimina per sempre una connessione GHL/Squadd — solo admin, stessa gerarchia di ogni altro
 * endpoint su questo tab (è una credenziale, non un dato operativo). Il KPI restano invariati
 * dopo l'eliminazione: sono letti live dall'API GHL, nulla di storico dipende da questa riga —
 * si può sempre ricollegare la stessa location in un secondo momento.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare una connessione GHL" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { connessioneId?: string };
  const { connessioneId } = body;
  if (!connessioneId) {
    return NextResponse.json({ error: "connessioneId obbligatorio" }, { status: 400 });
  }

  const connessioni = await getGhlConnessioni();
  if (!connessioni.some((c) => c.connessioneId === connessioneId)) {
    return NextResponse.json({ error: "Connessione non trovata" }, { status: 404 });
  }

  try {
    await eliminaGhlConnessione(connessioneId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
