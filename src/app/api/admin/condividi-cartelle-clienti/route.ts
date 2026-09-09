import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { condividiCartelleClientiEsistenti } from "@/lib/driveAccesso";
import { getClienti, getConsulenti } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Backfill una tantum (09/09/2026): concede l'accesso come collaboratore sulla cartella Drive
 * collegata al consulente assegnato per TUTTI i clienti esistenti con sia driveFolderUrl sia
 * consulenteId con email nota — copre i clienti creati prima che /api/clienti condividesse la
 * cartella in automatico (vedi condividiCartellaConConsulente lì, per creazioni/modifiche da qui
 * in avanti). Idempotente, sicura da rilanciare più volte: un cliente già condiviso torna "già
 * presente" nel report, non viene ri-condiviso né ri-notificato. Solo admin, nessun parametro —
 * stesso pattern di /api/admin/migra-assegnatari.
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
    const [clienti, consulenti] = await Promise.all([getClienti(), getConsulenti()]);
    const risultati = await condividiCartelleClientiEsistenti(clienti, consulenti);
    return NextResponse.json({ ok: true, risultati });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
