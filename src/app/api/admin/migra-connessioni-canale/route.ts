import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { migraConnessioniMeta } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Migrazione una tantum verso ConnessioniCanale (Fase 2 del redesign multi-canale): per ogni Sede
 * con adAccountId non vuoto, crea la connessione canale:"meta" equivalente — se non esiste già.
 * Idempotente — sicura da richiamare più volte, salta chi è già a posto. Solo admin, nessun
 * parametro. PURAMENTE PREPARATORIA: non cambia il percorso di sync reale (vedi
 * migraConnessioniMeta in lib/sheets.ts) — da lanciare una volta sola dopo aver verificato che la
 * tab ConnessioniCanale esiste sul foglio.
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
    const risultato = await migraConnessioniMeta();
    return NextResponse.json({ ok: true, ...risultato });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
