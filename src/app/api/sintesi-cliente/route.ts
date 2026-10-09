import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getAttivitaCliente, getClienteByAccessCode, getClienti } from "@/lib/archivio";
import { puoVedereCliente } from "@/lib/authz";
import { oggiIso } from "@/lib/roadmap";
import { sintesiLavori } from "@/lib/sintesiCliente";

export const runtime = "nodejs";

/**
 * Lo stato dei lavori di un cliente nella forma che il cliente può vedere (09/10/2026, per la sintesi
 * in cima alla sua pagina: vedi src/lib/sintesiCliente.ts). Come /api/fasi-completate ha un ramo
 * `code`, per il link pubblico, e uno per il team.
 *
 * È il solo indirizzo che porta al cliente qualcosa delle attività, e porta poco di proposito:
 * quante sono e quante fatte, i nomi delle fasi in corso, e per esteso soltanto le attività assegnate
 * a lui. Le descrizioni delle attività del team non escono mai da qui: /api/attivita resta riservata
 * al team, come la scheda Attività.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clienteIdParam = req.nextUrl.searchParams.get("clienteId");

  let clienteId: string;
  if (code) {
    const cliente = await getClienteByAccessCode(code);
    if (!cliente || !cliente.attivo) {
      return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
    }
    clienteId = cliente.clienteId;
  } else {
    const sessione = await getSessione();
    if (!sessione) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (!clienteIdParam) {
      return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
    }
    const clienti = await getClienti();
    if (!puoVedereCliente(sessione, clienteIdParam, clienti)) {
      return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
    }
    clienteId = clienteIdParam;
  }

  const oggi = oggiIso();
  const attivita = (await getAttivitaCliente()).filter((a) => a.clienteId === clienteId);
  return NextResponse.json({ oggi, lavori: sintesiLavori(attivita, oggi) });
}
