import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getSedi } from "@/lib/sheets";
import { backfillSede } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Recupero storico campagne per una sede (20/09/2026, vedi backfillSede in lib/sync.ts) — a
 * differenza di /api/sync-meta (finestra rolling fissa, riservato a tutti i ruoli con accesso al
 * cliente), qui l'admin sceglie esplicitamente da quando recuperare: solo admin, mai un'azione
 * accessibile a consulente/commerciale.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può recuperare lo storico campagne" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { sedeId?: string; since?: string };
  const sedeId = body.sedeId?.trim();
  const since = body.since?.trim();

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId mancante" }, { status: 400 });
  }
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    return NextResponse.json({ error: "Data di inizio non valida (formato AAAA-MM-GG)" }, { status: 400 });
  }

  const sede = (await getSedi()).find((s) => s.sedeId === sedeId);
  if (!sede) {
    return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  }
  if (!sede.adAccountId) {
    return NextResponse.json({ error: "Questa sede non ha un ad account Meta collegato" }, { status: 400 });
  }

  try {
    const { righe } = await backfillSede(sede, since);
    return NextResponse.json({ ok: true, righe });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
