import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { generaSedeId } from "@/lib/accessCode";
import { aggiornaSede, creaSede, getClienti, getSedi } from "@/lib/sheets";

export const runtime = "nodejs";

type BodyPost = {
  clienteId?: string;
  nome?: string;
  adAccountId?: string;
  targetCpa?: number | null;
  targetCpl?: number | null;
  tipoConversioneLead?: string;
};

/** Aggiunge una sede a un cliente esistente (dalla sezione "Sedi" di ModificaClienteModal). Solo admin. */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può aggiungere sedi" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPost;
  const clienteId = body.clienteId?.trim();
  const nome = body.nome?.trim();
  const adAccountId = body.adAccountId?.trim();

  if (!clienteId) {
    return NextResponse.json({ error: "clienteId obbligatorio" }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ error: "Nome sede obbligatorio" }, { status: 400 });
  }
  // Opzionale come alla creazione del cliente — vedi il commento in /api/clienti (POST): se
  // fornito deve avere il formato giusto, ma una sede può nascere senza (sincronizzabile dopo).
  if (adAccountId && !/^\d+$/.test(adAccountId)) {
    return NextResponse.json({ error: 'Ad account id non valido: solo cifre, senza il prefisso "act_"' }, { status: 400 });
  }

  const [clienti, sedi] = await Promise.all([getClienti(), getSedi()]);
  if (!clienti.some((c) => c.clienteId === clienteId)) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const sedeId = generaSedeId(clienteId, nome, new Set(sedi.map((s) => s.sedeId)));
  try {
    await creaSede({
      sedeId,
      clienteId,
      nome,
      adAccountId: adAccountId ?? "",
      targetCpa: body.targetCpa ?? null,
      targetCpl: body.targetCpl ?? null,
      tipoConversioneLead: body.tipoConversioneLead,
    });
    return NextResponse.json({ sedeId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}

type BodyPatch = {
  sedeId?: string;
  nome?: string;
  adAccountId?: string;
  targetCpa?: number | null;
  targetCpl?: number | null;
  tipoConversioneLead?: string;
  attivo?: boolean;
};

/**
 * Modifica una sede esistente. Aggiornamento parziale: solo i campi presenti nel body vengono
 * validati/scritti. `attivo: false` è la disattivazione (stesso spirito soft-disable di Cliente —
 * mai una cancellazione, i dati storici restano leggibili). Solo admin.
 */
export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può modificare le sedi" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const sedeId = body.sedeId?.trim();
  if (!sedeId) {
    return NextResponse.json({ error: "sedeId obbligatorio" }, { status: 400 });
  }

  const nome = body.nome !== undefined ? body.nome.trim() : undefined;
  if (nome !== undefined && !nome) {
    return NextResponse.json({ error: "Nome sede obbligatorio" }, { status: 400 });
  }
  const adAccountId = body.adAccountId !== undefined ? body.adAccountId.trim() : undefined;
  if (adAccountId !== undefined && !/^\d+$/.test(adAccountId)) {
    return NextResponse.json({ error: 'Ad account id non valido: solo cifre, senza il prefisso "act_"' }, { status: 400 });
  }

  const sedi = await getSedi();
  if (!sedi.some((s) => s.sedeId === sedeId)) {
    return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  }

  try {
    await aggiornaSede({
      sedeId,
      nome,
      adAccountId,
      targetCpa: body.targetCpa,
      targetCpl: body.targetCpl,
      tipoConversioneLead: body.tipoConversioneLead,
      attivo: body.attivo,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
