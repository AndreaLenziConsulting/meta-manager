import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaScadenzaAttivita, getAttivitaCliente, getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";

export const runtime = "nodejs";

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Cambia la data di scadenza (dataFine) di una singola attività, dalla vista Lista. */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    attivitaId?: string;
    dataFine?: string;
  };
  const { clienteId, attivitaId, dataFine } = body;

  if (!clienteId || !attivitaId || !dataFine) {
    return NextResponse.json({ error: "clienteId, attivitaId e dataFine sono obbligatori" }, { status: 400 });
  }
  if (!DATA_ISO_RE.test(dataFine)) {
    return NextResponse.json({ error: "Data non valida (formato atteso GGGG-MM-GG)" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  // Stessa verifica di /api/attivita/stato: non ci si affida solo alla convenzione di naming.
  const attivita = await getAttivitaCliente();
  const riga = attivita.find((a) => a.attivitaId === attivitaId);
  if (!riga || riga.clienteId !== clienteId) {
    return NextResponse.json({ error: "Attività non trovata per questo cliente" }, { status: 404 });
  }

  try {
    await aggiornaScadenzaAttivita(attivitaId, dataFine);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
