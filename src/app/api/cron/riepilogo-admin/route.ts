import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { inviaRiepilogoAdmin } from "@/lib/riepilogoAdminInvio";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Invio programmato del riepilogo per l'amministrazione: ogni lunedì mattina (vedi vercel.json).
 * Stessa protezione di /api/cron/sync-meta: lo chiama solo Vercel, col segreto del cron.
 *
 * Se l'invio fallisce risponde 502 col motivo: resta nei log di Vercel, e dalla sezione "Notifiche"
 * delle Impostazioni si può riprovare con "Manda ora", che mostra lo stesso errore a schermo.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await inviaRiepilogoAdmin()) });
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error(`[cron/riepilogo-admin] invio non riuscito: ${messaggio}`);
    return NextResponse.json({ error: messaggio }, { status: 502 });
  }
}
