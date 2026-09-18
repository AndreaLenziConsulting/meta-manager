import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { eliminaCategoriaCommerciale, getCategorieCommerciali } from "@/lib/sheets";

export const runtime = "nodejs";

/** Elimina per sempre una categoria commerciale — solo admin, stessa gerarchia di ogni altro
 * endpoint su questo tab (target finanziari, non un dato operativo). */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può eliminare una categoria commerciale" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { categoriaId?: string };
  const { categoriaId } = body;
  if (!categoriaId) {
    return NextResponse.json({ error: "categoriaId obbligatorio" }, { status: 400 });
  }

  const categorie = await getCategorieCommerciali({ noCache: true });
  if (!categorie.some((c) => c.categoriaId === categoriaId)) {
    return NextResponse.json({ error: "Categoria non trovata" }, { status: 404 });
  }

  try {
    await eliminaCategoriaCommerciale(categoriaId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
