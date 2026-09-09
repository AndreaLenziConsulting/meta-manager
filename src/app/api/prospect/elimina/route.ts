import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaProspect, getProspect } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Elimina per sempre un prospect (e tutti i suoi report commerciali) — solo admin, stessa
 * gerarchia di POST /api/prospect/converti. Un prospect già convertito in cliente
 * (`prospect.clienteId` non vuoto) NON è eliminabile: distruggerebbe lo storico ReportCommerciale
 * di un cliente vivo per un guadagno minimo — chi vuole eliminare tutto lo fa dal Cliente (vedi
 * POST /api/clienti/elimina), che ha la conferma pesante apposta per una cascata di questa scala.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare un prospect" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { prospectId?: string };
  const { prospectId } = body;
  if (!prospectId) {
    return NextResponse.json({ error: "prospectId obbligatorio" }, { status: 400 });
  }

  const prospetti = await getProspect();
  const prospect = prospetti.find((p) => p.prospectId === prospectId);
  if (!prospect) {
    return NextResponse.json({ error: "Prospect non trovato" }, { status: 404 });
  }
  if (prospect.clienteId) {
    return NextResponse.json(
      { error: `Prospect già convertito nel cliente "${prospect.clienteId}" — non eliminabile da qui` },
      { status: 409 }
    );
  }

  try {
    await eliminaProspect(prospectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
