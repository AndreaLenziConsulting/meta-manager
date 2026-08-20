import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { migraSediEsistenti } from "@/lib/sheets";

export const runtime = "nodejs";

/**
 * Migrazione una tantum al modello Sede: per ogni cliente senza ancora una sede, ne crea una
 * "Principale" con i valori ancora presenti (vestigiali) su Clienti, poi backfilla sedeId su
 * Campagne/Funnel. Idempotente — sicura da richiamare più volte, salta chi è già a posto. Solo
 * admin, nessun parametro: da lanciare una volta sola dopo il deploy del modello Sede.
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
    const risultato = await migraSediEsistenti();
    return NextResponse.json({ ok: true, ...risultato });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
