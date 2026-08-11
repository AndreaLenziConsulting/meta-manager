import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaStatoAttivita, getAttivitaCliente, getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import type { StatoAttivita } from "@/types/kpi";

export const runtime = "nodejs";

const STATI_VALIDI: StatoAttivita[] = ["todo", "wip", "done", "blocked"];

export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    attivitaId?: string;
    stato?: string;
    notaTeam?: string;
  };
  const { clienteId, attivitaId, stato, notaTeam } = body;

  if (!clienteId || !attivitaId || !stato) {
    return NextResponse.json({ error: "clienteId, attivitaId e stato sono obbligatori" }, { status: 400 });
  }
  if (!STATI_VALIDI.includes(stato as StatoAttivita)) {
    return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }
  if (stato === "blocked" && !notaTeam?.trim()) {
    return NextResponse.json({ error: "Il motivo del blocco è obbligatorio" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  // Non ci si affida solo alla convenzione di naming attivitaId = "${clienteId}::${taskId}":
  // si verifica che la riga esista davvero e appartenga al cliente richiesto.
  const attivita = await getAttivitaCliente();
  const riga = attivita.find((a) => a.attivitaId === attivitaId);
  if (!riga || riga.clienteId !== clienteId) {
    return NextResponse.json({ error: "Attività non trovata per questo cliente" }, { status: 404 });
  }

  try {
    await aggiornaStatoAttivita(attivitaId, stato as StatoAttivita, notaTeam?.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
