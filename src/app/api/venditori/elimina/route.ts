import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaVenditore, getVenditori } from "@/lib/sheets";

export const runtime = "nodejs";

/** Elimina per sempre un venditore — solo admin, stessa gerarchia di ogni altro endpoint su questo
 * tab. I suoi RisultatiVenditori storici restano nel foglio ma orfani (mai cancellati da qui). */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare un venditore" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { venditoreId?: string };
  const { venditoreId } = body;
  if (!venditoreId) {
    return NextResponse.json({ error: "venditoreId obbligatorio" }, { status: 400 });
  }

  const venditori = await getVenditori({ noCache: true });
  if (!venditori.some((v) => v.venditoreId === venditoreId)) {
    return NextResponse.json({ error: "Venditore non trovato" }, { status: 404 });
  }

  try {
    await eliminaVenditore(venditoreId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
