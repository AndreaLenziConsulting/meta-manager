import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaAssegnatariAttivita, getAttivitaCliente, getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { normalizzaAssegnatari, SENTINELLA_NON_ASSEGNATO } from "@/lib/assegnatari";

export const runtime = "nodejs";

/**
 * Cambia gli assegnatari di una singola attività — mirror esatto di /api/attivita/scadenza (stesso
 * auth gate, sessione + puoVedereCliente, mai admin-only: gestire gli assegnatari di un proprio
 * cliente non è diverso da cambiarne la scadenza). Prima route che permette di editare gli
 * assegnatari DOPO la creazione — prima della migrazione a `assegnatari: string[]` (08/09/2026)
 * non esisteva alcun modo di farlo dalla UI una volta creato il task.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    attivitaId?: string;
    assegnatari?: string[];
  };
  const { clienteId, attivitaId } = body;

  if (!clienteId || !attivitaId) {
    return NextResponse.json({ error: "clienteId e attivitaId sono obbligatori" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  // Stessa verifica di /api/attivita/scadenza: non ci si affida solo alla convenzione di naming.
  const attivita = await getAttivitaCliente();
  const riga = attivita.find((a) => a.attivitaId === attivitaId);
  if (!riga || riga.clienteId !== clienteId) {
    return NextResponse.json({ error: "Attività non trovata per questo cliente" }, { status: 404 });
  }

  // Stesso flatMap+normalizzazione di /api/attivita/crea — unico punto di normalizzazione, vedi
  // src/lib/assegnatari.ts. Nessun assegnatario valido -> sentinella, mai un array vuoto salvato.
  const assegnatari =
    body.assegnatari && body.assegnatari.length > 0 ? body.assegnatari.flatMap((a) => normalizzaAssegnatari(a)) : [SENTINELLA_NON_ASSEGNATO];

  try {
    await aggiornaAssegnatariAttivita(attivitaId, assegnatari);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
