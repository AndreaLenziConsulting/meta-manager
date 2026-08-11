import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getAttivitaCliente, getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { raggruppaPerFase } from "@/lib/roadmap";

export const runtime = "nodejs";

/**
 * Roadmap di un cliente, raggruppata per fase. Nessun accesso pubblico via `code`: a differenza
 * di /api/kpi, questa route è riservata al team (admin/consulente autorizzato sul cliente) — il
 * tab Attività non è mai visibile al cliente finale, il nascondimento in UI è solo cosmetico.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }
  const cliente = clienti.find((c) => c.clienteId === clienteId)!;

  const tutte = await getAttivitaCliente();
  const attivita = tutte.filter((a) => a.clienteId === clienteId);
  const gruppi = raggruppaPerFase(attivita);

  return NextResponse.json({
    cliente: {
      clienteId: cliente.clienteId,
      nome: cliente.nome,
      prodottoId: cliente.prodottoId,
      dataInizioProgetto: cliente.dataInizioProgetto,
    },
    gruppi,
  });
}
