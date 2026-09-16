import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { migraFunnelClientiEsistenti } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Backfill una tantum (11/2026, overhaul "landing page" → funnel multipli, vedi il commento su
 * migraFunnelClientiEsistenti in sheets.ts) — stesso pattern di /api/admin/migra-sedi. Solo admin,
 * nessun parametro. Idempotente, sicura da rilanciare più volte.
 */
export async function POST() {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eseguire questa operazione" }, { status: 403 });
  }

  try {
    const risultato = await migraFunnelClientiEsistenti();
    return NextResponse.json({ ok: true, ...risultato });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
