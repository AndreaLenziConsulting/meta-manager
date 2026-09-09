import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaCliente, getClienti } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Elimina per sempre un cliente e tutti i suoi dati collegati (vedi eliminaCliente in sheets.ts
 * per l'elenco esatto della cascata) — solo admin. La conferma pesante (digitare il nome esatto,
 * vedi ConfermaEliminazioneNomeModal.tsx) è tutta lato UI: qui la si ri-verifica comunque
 * server-side, stesso spirito del bottone disabilitato finché non combacia — un client compromesso
 * o una chiamata diretta all'API non deve poter bypassare la conferma.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare un cliente" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { clienteId?: string; nomeConferma?: string };
  const { clienteId, nomeConferma } = body;
  if (!clienteId || !nomeConferma) {
    return NextResponse.json({ error: "clienteId e nomeConferma sono obbligatori" }, { status: 400 });
  }

  const clienti = await getClienti();
  const cliente = clienti.find((c) => c.clienteId === clienteId);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  if (nomeConferma.trim() !== cliente.nome.trim()) {
    return NextResponse.json({ error: "Il nome digitato non corrisponde al nome del cliente" }, { status: 400 });
  }

  try {
    await eliminaCliente(clienteId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
