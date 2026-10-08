import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";

/**
 * Per gli indirizzi riservati all'amministratore (pagina Impostazioni): la risposta d'errore da
 * restituire subito, o null se chi chiama è l'amministratore. `cosa` completa la frase "Solo
 * l'amministratore può …".
 */
export async function rifiutoSeNonAdmin(cosa: string): Promise<NextResponse | null> {
  const sessione = await getSessione();
  if (!sessione) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (sessione.ruolo !== "admin") return NextResponse.json({ error: `Solo l'amministratore può ${cosa}` }, { status: 403 });
  return null;
}

export function erroreRisposta(messaggio: string, status: number): NextResponse {
  return NextResponse.json({ error: messaggio }, { status });
}

export function messaggioDi(err: unknown, ripiego: string): string {
  return err instanceof Error ? err.message : ripiego;
}
