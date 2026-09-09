import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaMeeting, getClienti, getMeetingCliente } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Elimina un meeting per sempre — SOLO admin, mai il consulente (che può comunque vedere/creare/
 * modificare meeting per i propri clienti, ma non eliminarli): prima eliminazione admin-only di
 * questa fase, stessa direttiva per Clienti/Prospect/Sedi/Connessioni GHL nelle fasi successive.
 * Controlla solo ESISTENZA (mai `puoVedereCliente`, che filtrerebbe anche su attivo/consulente
 * assegnato) — un admin deve poter pulire anche un cliente già disattivato. Stesso doppio controllo
 * di `/api/attivita/elimina`: non ci si affida solo al meetingId, si verifica anche che appartenga
 * al clienteId dichiarato.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare un meeting" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { clienteId?: string; meetingId?: string };
  const { clienteId, meetingId } = body;
  if (!clienteId || !meetingId) {
    return NextResponse.json({ error: "clienteId e meetingId sono obbligatori" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!clienti.some((c) => c.clienteId === clienteId)) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const meeting = await getMeetingCliente();
  const riga = meeting.find((m) => m.meetingId === meetingId);
  if (!riga || riga.clienteId !== clienteId) {
    return NextResponse.json({ error: "Meeting non trovato per questo cliente" }, { status: 404 });
  }

  try {
    await eliminaMeeting(meetingId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
