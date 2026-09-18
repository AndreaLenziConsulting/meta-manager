import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaCategoriaCommerciale, creaCategoriaCommerciale, getCategorieCommerciali, getSedi } from "@/lib/sheets";

export const runtime = "nodejs";

const MAX_CATEGORIE_PER_SEDE = 3;

/**
 * CRUD delle categorie commerciali (cluster) per sede — SOLO admin, stessa gerarchia di /api/sedi:
 * sono target finanziari concordati col cliente, non un dato operativo che il consulente aggiorna
 * di routine (vedi PATCH /api/sedi, che già gate-a admin-only gli stessi 4 target a livello di
 * intera sede — qui è la stessa cosa, solo scomposta per categoria).
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può vedere le categorie commerciali" }, { status: 403 });
  }

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const [sedi, categorie] = await Promise.all([getSedi(), getCategorieCommerciali()]);
  const sediIds = new Set(sedi.filter((s) => s.clienteId === clienteId).map((s) => s.sedeId));
  const risultato = categorie.filter((c) => sediIds.has(c.sedeId));
  return NextResponse.json({ categorie: risultato });
}

type BodyPost = {
  sedeId?: string;
  nome?: string;
  targetBudgetMensile?: number | null;
  targetLeadSettimana?: number | null;
  targetAppuntamentiSettimana?: number | null;
  targetFatturatoMensile?: number | null;
};

export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può aggiungere categorie commerciali" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPost;
  const sedeId = body.sedeId?.trim();
  const nome = body.nome?.trim();

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId obbligatorio" }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ error: "Il nome della categoria è obbligatorio" }, { status: 400 });
  }

  const [sedi, esistenti] = await Promise.all([getSedi(), getCategorieCommerciali({ noCache: true })]);
  if (!sedi.some((s) => s.sedeId === sedeId)) {
    return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  }
  const dellaStessaSede = esistenti.filter((c) => c.sedeId === sedeId);
  if (dellaStessaSede.length >= MAX_CATEGORIE_PER_SEDE) {
    return NextResponse.json({ error: `Al massimo ${MAX_CATEGORIE_PER_SEDE} categorie per sede` }, { status: 409 });
  }
  if (dellaStessaSede.some((c) => c.nome.trim().toLowerCase() === nome.toLowerCase())) {
    return NextResponse.json({ error: `Esiste già una categoria "${nome}" per questa sede` }, { status: 409 });
  }

  const categoriaId = `${sedeId}--${randomUUID().slice(0, 8)}`;
  try {
    await creaCategoriaCommerciale({
      categoriaId,
      sedeId,
      nome,
      ordine: dellaStessaSede.length + 1,
      targetBudgetMensile: body.targetBudgetMensile ?? null,
      targetLeadSettimana: body.targetLeadSettimana ?? null,
      targetAppuntamentiSettimana: body.targetAppuntamentiSettimana ?? null,
      targetFatturatoMensile: body.targetFatturatoMensile ?? null,
    });
    return NextResponse.json({ categoriaId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}

type BodyPatch = {
  categoriaId?: string;
  nome?: string;
  tagGhl?: string;
  targetBudgetMensile?: number | null;
  targetLeadSettimana?: number | null;
  targetAppuntamentiSettimana?: number | null;
  targetFatturatoMensile?: number | null;
};

export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può modificare le categorie commerciali" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const categoriaId = body.categoriaId?.trim();
  if (!categoriaId) {
    return NextResponse.json({ error: "categoriaId obbligatorio" }, { status: 400 });
  }
  const nome = body.nome?.trim();
  if (body.nome !== undefined && !nome) {
    return NextResponse.json({ error: "Il nome della categoria è obbligatorio" }, { status: 400 });
  }

  const categorie = await getCategorieCommerciali({ noCache: true });
  const corrente = categorie.find((c) => c.categoriaId === categoriaId);
  if (!corrente) {
    return NextResponse.json({ error: "Categoria commerciale non trovata" }, { status: 404 });
  }
  if (
    nome &&
    categorie.some((c) => c.sedeId === corrente.sedeId && c.categoriaId !== categoriaId && c.nome.trim().toLowerCase() === nome.toLowerCase())
  ) {
    return NextResponse.json({ error: `Esiste già una categoria "${nome}" per questa sede` }, { status: 409 });
  }

  try {
    await aggiornaCategoriaCommerciale({
      categoriaId,
      nome,
      tagGhl: body.tagGhl !== undefined ? body.tagGhl.trim() : undefined,
      targetBudgetMensile: body.targetBudgetMensile,
      targetLeadSettimana: body.targetLeadSettimana,
      targetAppuntamentiSettimana: body.targetAppuntamentiSettimana,
      targetFatturatoMensile: body.targetFatturatoMensile,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
