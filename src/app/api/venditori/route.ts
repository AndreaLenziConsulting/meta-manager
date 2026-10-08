import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaVenditore, creaVenditore, getSedi, getVenditori } from "@/lib/archivio";

export const runtime = "nodejs";

/**
 * CRUD dell'anagrafica venditori per sede — SOLO admin, stessa gerarchia di /api/sedi e
 * /api/categorie-commerciali: sono target/capienze concordati col cliente, non un dato operativo
 * che il consulente aggiorna di routine.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può vedere i venditori" }, { status: 403 });
  }

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const [sedi, venditori] = await Promise.all([getSedi(), getVenditori()]);
  const sediIds = new Set(sedi.filter((s) => s.clienteId === clienteId).map((s) => s.sedeId));
  const risultato = venditori.filter((v) => sediIds.has(v.sedeId));
  return NextResponse.json({ venditori: risultato });
}

type BodyPost = { sedeId?: string; nome?: string; capienzaAppuntamentiMensile?: number | null; ghlUserId?: string };

/**
 * La capienza (appuntamenti al mese che il venditore può reggere) è facoltativa dall'08/10/2026:
 * serve solo a dividere il target della sede fra i venditori in "Ritmo sul target". Obbligarla
 * voleva dire inventare un numero per chi vuole solo vedere l'andamento. 0 = non indicata.
 */
function capienzaValida(valore: number | null | undefined): boolean {
  return valore === undefined || valore === null || (Number.isFinite(valore) && valore >= 0);
}

export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può aggiungere venditori" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPost;
  const sedeId = body.sedeId?.trim();
  const nome = body.nome?.trim();
  const capienza = body.capienzaAppuntamentiMensile;

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId obbligatorio" }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ error: "Il nome del venditore è obbligatorio" }, { status: 400 });
  }
  if (!capienzaValida(capienza)) {
    return NextResponse.json({ error: "La capienza (appuntamenti al mese) deve essere un numero da zero in su, oppure vuota" }, { status: 400 });
  }

  const [sedi, esistenti] = await Promise.all([getSedi(), getVenditori({ noCache: true })]);
  if (!sedi.some((s) => s.sedeId === sedeId)) {
    return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  }
  const dellaStessaSede = esistenti.filter((v) => v.sedeId === sedeId);
  if (dellaStessaSede.some((v) => v.nome.trim().toLowerCase() === nome.toLowerCase())) {
    return NextResponse.json({ error: `Esiste già un venditore "${nome}" per questa sede` }, { status: 409 });
  }

  const venditoreId = `${sedeId}--${randomUUID().slice(0, 8)}`;
  try {
    await creaVenditore({ venditoreId, sedeId, nome, capienzaAppuntamentiMensile: capienza ?? 0 });
    const ghlUserId = body.ghlUserId?.trim();
    if (ghlUserId) await aggiornaVenditore({ venditoreId, ghlUserId });
    return NextResponse.json({ venditoreId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}

type BodyPatch = { venditoreId?: string; nome?: string; ghlUserId?: string; capienzaAppuntamentiMensile?: number | null; attivo?: boolean };

export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può modificare i venditori" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const venditoreId = body.venditoreId?.trim();
  if (!venditoreId) {
    return NextResponse.json({ error: "venditoreId obbligatorio" }, { status: 400 });
  }
  const nome = body.nome?.trim();
  if (body.nome !== undefined && !nome) {
    return NextResponse.json({ error: "Il nome del venditore è obbligatorio" }, { status: 400 });
  }
  if (!capienzaValida(body.capienzaAppuntamentiMensile)) {
    return NextResponse.json({ error: "La capienza (appuntamenti al mese) deve essere un numero da zero in su, oppure vuota" }, { status: 400 });
  }

  const venditori = await getVenditori({ noCache: true });
  const corrente = venditori.find((v) => v.venditoreId === venditoreId);
  if (!corrente) {
    return NextResponse.json({ error: "Venditore non trovato" }, { status: 404 });
  }
  if (
    nome &&
    venditori.some((v) => v.sedeId === corrente.sedeId && v.venditoreId !== venditoreId && v.nome.trim().toLowerCase() === nome.toLowerCase())
  ) {
    return NextResponse.json({ error: `Esiste già un venditore "${nome}" per questa sede` }, { status: 409 });
  }

  try {
    await aggiornaVenditore({
      venditoreId,
      nome,
      ghlUserId: body.ghlUserId !== undefined ? body.ghlUserId.trim() : undefined,
      capienzaAppuntamentiMensile: body.capienzaAppuntamentiMensile === null ? 0 : body.capienzaAppuntamentiMensile,
      attivo: typeof body.attivo === "boolean" ? body.attivo : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
