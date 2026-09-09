import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { migraAssegnatariEsistenti } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Migrazione una tantum al campo assegnatari multipli reali (08/09/2026): normalizza la colonna
 * "responsabile" (ora "assegnatari") di AttivitaCliente e TemplateAttivita dal testo libero
 * storico (delimitatori misti " + "/" & "/" e "/"/") alla forma comma-separated canonica — vedi
 * migraAssegnatariEsistenti in sheets.ts. Idempotente, sicura da rilanciare più volte: righe già
 * in forma canonica non vengono riscritte. Solo admin, nessun parametro. La risposta include il
 * diff riga per riga di cosa è stato cambiato, per revisione — mai una scrittura "silenziosa".
 */
export async function POST() {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eseguire la migrazione" }, { status: 403 });
  }

  try {
    const risultato = await migraAssegnatariEsistenti();
    return NextResponse.json({ ok: true, ...risultato });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
