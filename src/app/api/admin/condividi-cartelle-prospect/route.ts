import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { condividiCartelleProspectEsistenti } from "@/lib/driveAccesso";
import { getCommerciali, getProspect } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Backfill una tantum (11/2026, "Google drive non è condiviso con Stefano") — equivalente a
 * /api/admin/condividi-cartelle-clienti ma per i PROSPECT e il loro commerciale assegnato:
 * concede l'accesso come collaboratore sulla cartella Drive collegata per TUTTI i prospect
 * esistenti con sia driveFolderUrl sia commercialeId con email nota. Copre i prospect creati prima
 * che POST/PATCH /api/prospect condividessero la cartella in automatico. Idempotente, sicura da
 * rilanciare più volte: un prospect già condiviso torna "già presente", non viene ri-notificato.
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
    const [prospect, commerciali] = await Promise.all([getProspect(), getCommerciali()]);
    const risultati = await condividiCartelleProspectEsistenti(prospect, commerciali);
    return NextResponse.json({ ok: true, risultati });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
