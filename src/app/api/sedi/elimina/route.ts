import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaSede, getSedi } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Elimina per sempre una sede — solo admin, stessa gerarchia di POST/PATCH /api/sedi. Guard
 * "ultima sede del cliente" qui (non in sheets.ts, che non valida il cliente — vedi commento su
 * eliminaSede): conta TUTTE le sedi del cliente, anche inattive, per preservare alla lettera
 * l'invariante "un cliente ha sempre almeno una sede" (vedi commento su getSedi in sheets.ts).
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare una sede" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { sedeId?: string; clienteId?: string };
  const { sedeId, clienteId } = body;
  if (!sedeId || !clienteId) {
    return NextResponse.json({ error: "sedeId e clienteId sono obbligatori" }, { status: 400 });
  }

  const sedi = await getSedi();
  const sede = sedi.find((s) => s.sedeId === sedeId);
  if (!sede || sede.clienteId !== clienteId) {
    return NextResponse.json({ error: "Sede non trovata per questo cliente" }, { status: 404 });
  }

  const sediDelCliente = sedi.filter((s) => s.clienteId === clienteId);
  if (sediDelCliente.length <= 1) {
    return NextResponse.json(
      { error: "Non puoi eliminare l'unica sede di un cliente — un cliente deve avere sempre almeno una sede" },
      { status: 409 }
    );
  }

  try {
    await eliminaSede(sedeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
