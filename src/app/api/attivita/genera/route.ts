import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { generaAttivitaPerCliente } from "@/lib/roadmap";
import { creaAttivitaPerCliente, getClienti, getTemplateAttivita } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * (Ri)genera la roadmap di un cliente che ha già prodotto/data inizio assegnati — idempotente
 * (creaAttivitaPerCliente salta le righe già presenti), utile sia dopo un fallimento parziale in
 * fase di creazione cliente sia per un cliente pre-esistente a cui si assegna un prodotto in seguito.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può generare la roadmap" }, { status: 403 });
  }

  const { clienteId } = (await req.json().catch(() => ({}))) as { clienteId?: string };
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const clienti = await getClienti();
  const cliente = clienti.find((c) => c.clienteId === clienteId);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  if (!cliente.prodottoId || !cliente.dataInizioProgetto) {
    return NextResponse.json(
      { error: "Il cliente non ha un prodotto o una data di inizio progetto assegnati" },
      { status: 400 }
    );
  }

  try {
    const template = await getTemplateAttivita();
    const righe = generaAttivitaPerCliente(cliente.clienteId, cliente.prodottoId, cliente.dataInizioProgetto, template);
    if (righe.length === 0) {
      return NextResponse.json({ error: `Nessun template trovato per il prodotto "${cliente.prodottoId}"` }, { status: 400 });
    }
    await creaAttivitaPerCliente(righe);
    return NextResponse.json({ ok: true, righe: righe.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
