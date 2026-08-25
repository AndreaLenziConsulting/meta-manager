import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getGhlConnessioni } from "@/lib/sheets";
import { fetchCalendari } from "@/lib/ghl";

export const runtime = "nodejs";

/**
 * Elenco dei calendari di una connessione GHL già salvata — usa il token memorizzato lato
 * server, mai esposto al browser. Solo admin, stesso motivo di /api/ghl-connessioni: serve solo
 * al picker "quali calendari includere" in ModificaClienteModal.tsx.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può vedere i calendari GHL" }, { status: 403 });
  }

  const connessioneId = req.nextUrl.searchParams.get("connessioneId");
  if (!connessioneId) {
    return NextResponse.json({ error: "connessioneId mancante" }, { status: 400 });
  }

  const connessioni = await getGhlConnessioni();
  const connessione = connessioni.find((c) => c.connessioneId === connessioneId);
  if (!connessione) {
    return NextResponse.json({ error: "Connessione GHL non trovata" }, { status: 404 });
  }

  try {
    const calendari = await fetchCalendari(connessione.locationId, connessione.privateToken);
    return NextResponse.json({ calendari, calendarIdsSelezionati: connessione.calendarIds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore dal collegamento GHL: ${msg}` }, { status: 502 });
  }
}
