import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaCliente, getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { trovaOCreaFileAppuntamenti } from "@/lib/appuntamentiFile";

export const runtime = "nodejs";

/**
 * Get-or-create del file di compilazione appuntamenti di UN cliente, dentro la sua cartella Drive
 * (Cliente.driveFolderUrl) — chiamata da ClienteHeader.tsx per le sedi senza connessione GHL
 * attiva (il chiamante applica quel gate, non questa route: qui basta poter vedere il cliente).
 * Mai sul link pubblico (nessun ramo `code`): stesso motivo di /api/attivita, è uno strumento
 * operativo del team, non un dato da mostrare al cliente finale.
 *
 * Fast-path: se Cliente.appuntamentiFileUrl è già impostato (creato in una chiamata precedente),
 * torna quello senza mai toccare Drive — la creazione vera avviene una sola volta per cliente,
 * ogni chiamata successiva è una semplice lettura dal foglio.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { clienteId } = (await req.json().catch(() => ({}))) as { clienteId?: string };
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }
  const cliente = clienti.find((c) => c.clienteId === clienteId);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  if (cliente.appuntamentiFileUrl) {
    return NextResponse.json({ url: cliente.appuntamentiFileUrl });
  }
  if (!cliente.driveFolderUrl) {
    return NextResponse.json(
      { error: "Collega prima la cartella Drive del cliente: senza, non c'è dove creare il file." },
      { status: 409 }
    );
  }

  try {
    const url = await trovaOCreaFileAppuntamenti(cliente.driveFolderUrl, cliente.nome);
    await aggiornaCliente({ clienteId, appuntamentiFileUrl: url });
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore Drive: ${msg}` }, { status: 502 });
  }
}
