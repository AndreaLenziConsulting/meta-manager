import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaGhlConnessione, creaGhlConnessione, getGhlConnessioni, getSedi } from "@/lib/sheets";

export const runtime = "nodejs";

/** Non il token vero, mai: solo abbastanza per riconoscerlo ("••••3f9a"). */
function maschera(token: string): string {
  if (token.length <= 4) return "••••";
  return `••••${token.slice(-4)}`;
}

/**
 * CRUD delle connessioni GHL/Squadd per sede — solo admin (stessa gerarchia di /api/sedi: questa
 * è una credenziale, non un dato operativo). Il token non transita mai per intero verso il
 * browser dopo la creazione: GET restituisce solo un `tokenMascherato`.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può vedere le connessioni GHL" }, { status: 403 });
  }

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const [sedi, connessioni] = await Promise.all([getSedi(), getGhlConnessioni()]);
  const sediIds = new Set(sedi.filter((s) => s.clienteId === clienteId).map((s) => s.sedeId));
  const risultato = connessioni
    .filter((c) => sediIds.has(c.sedeId))
    .map((c) => ({
      connessioneId: c.connessioneId,
      sedeId: c.sedeId,
      locationId: c.locationId,
      attivo: c.attivo,
      note: c.note,
      tokenMascherato: maschera(c.privateToken),
      calendarIds: c.calendarIds,
    }));
  return NextResponse.json({ connessioni: risultato });
}

type BodyPost = { sedeId?: string; locationId?: string; privateToken?: string; note?: string };

export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può collegare GHL" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPost;
  const sedeId = body.sedeId?.trim();
  const locationId = body.locationId?.trim();
  const privateToken = body.privateToken?.trim();

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId obbligatorio" }, { status: 400 });
  }
  if (!locationId) {
    return NextResponse.json({ error: "Location ID obbligatorio" }, { status: 400 });
  }
  if (!privateToken) {
    return NextResponse.json({ error: "Private Integration Token obbligatorio" }, { status: 400 });
  }

  const [sedi, connessioni] = await Promise.all([getSedi(), getGhlConnessioni()]);
  if (!sedi.some((s) => s.sedeId === sedeId)) {
    return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  }
  if (connessioni.some((c) => c.sedeId === sedeId && c.attivo)) {
    return NextResponse.json({ error: "Questa sede ha già una connessione GHL attiva" }, { status: 409 });
  }

  const connessioneId = `${sedeId}--ghl`;
  try {
    await creaGhlConnessione({ connessioneId, sedeId, locationId, privateToken, note: body.note });
    return NextResponse.json({ connessioneId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}

type BodyPatch = {
  connessioneId?: string;
  locationId?: string;
  privateToken?: string;
  attivo?: boolean;
  note?: string;
  calendarIds?: string[];
};

export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può modificare le connessioni GHL" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const connessioneId = body.connessioneId?.trim();
  if (!connessioneId) {
    return NextResponse.json({ error: "connessioneId obbligatorio" }, { status: 400 });
  }

  // Stringa vuota dal form significa "non toccare il token" (non viene mai ri-mostrato per
  // intero, vedi GhlConnessioneRow) — solo un valore non vuoto arriva qui come vera intenzione di
  // sovrascriverlo. `undefined` (campo assente dal body) resta comunque "non toccare".
  const privateToken = body.privateToken?.trim();

  const connessioni = await getGhlConnessioni();
  if (!connessioni.some((c) => c.connessioneId === connessioneId)) {
    return NextResponse.json({ error: "Connessione GHL non trovata" }, { status: 404 });
  }

  try {
    await aggiornaGhlConnessione({
      connessioneId,
      locationId: body.locationId?.trim(),
      privateToken: privateToken ? privateToken : undefined,
      attivo: body.attivo,
      note: body.note,
      calendarIds: body.calendarIds,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
