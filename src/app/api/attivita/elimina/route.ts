import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaAttivita, getAttivitaCliente, getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";

export const runtime = "nodejs";

/** Elimina una singola attività dalla vista Lista. Nessun soft-delete: la riga sparisce dal foglio. */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { clienteId?: string; attivitaId?: string };
  const { clienteId, attivitaId } = body;

  if (!clienteId || !attivitaId) {
    return NextResponse.json({ error: "clienteId e attivitaId sono obbligatori" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  // Stessa verifica di /api/attivita/stato e /api/attivita/scadenza: non ci si affida solo alla
  // convenzione di naming attivitaId = "${clienteId}::${taskId}".
  const attivita = await getAttivitaCliente();
  const riga = attivita.find((a) => a.attivitaId === attivitaId);
  if (!riga || riga.clienteId !== clienteId) {
    return NextResponse.json({ error: "Attività non trovata per questo cliente" }, { status: 404 });
  }

  try {
    await eliminaAttivita(attivitaId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
