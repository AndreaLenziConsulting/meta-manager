import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaConnessioneCanale, creaConnessioneCanale, getConnessioniCanale, getSedi } from "@/lib/sheets";
import { validaAccountId } from "@/lib/adAccountId";
import type { Canale } from "@/types/kpi";

export const runtime = "nodejs";

const CANALI_VALIDI: Canale[] = ["meta", "google"];

/**
 * CRUD delle connessioni canale (Meta Ads/Google Ads) per sede — solo admin, stesso principio di
 * gerarchia di /api/ghl-connessioni e /api/sedi. A differenza del token GHL, accountId/
 * tipoConversioneLead non sono credenziali (nessun mascheramento in GET). Fase 2 del redesign
 * multi-canale — non ancora consumata dal sync reale, vedi types/connessioniCanale.ts.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può vedere le connessioni canale" }, { status: 403 });
  }

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const [sedi, connessioni] = await Promise.all([getSedi(), getConnessioniCanale()]);
  const sediIds = new Set(sedi.filter((s) => s.clienteId === clienteId).map((s) => s.sedeId));
  const risultato = connessioni.filter((c) => sediIds.has(c.sedeId));
  return NextResponse.json({ connessioni: risultato });
}

type BodyPost = { sedeId?: string; canale?: string; accountId?: string; tipoConversioneLead?: string; note?: string };

export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può collegare un canale" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPost;
  const sedeId = body.sedeId?.trim();
  const canale = body.canale as Canale | undefined;
  const accountIdGrezzo = body.accountId?.trim();

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId obbligatorio" }, { status: 400 });
  }
  if (!canale || !CANALI_VALIDI.includes(canale)) {
    return NextResponse.json({ error: "canale obbligatorio (meta o google)" }, { status: 400 });
  }
  if (!accountIdGrezzo) {
    return NextResponse.json({ error: "accountId obbligatorio" }, { status: 400 });
  }
  const esitoAccountId = validaAccountId(canale, accountIdGrezzo);
  if (!esitoAccountId.ok) {
    return NextResponse.json({ error: esitoAccountId.errore }, { status: 400 });
  }

  const [sedi, connessioni] = await Promise.all([getSedi(), getConnessioniCanale()]);
  if (!sedi.some((s) => s.sedeId === sedeId)) {
    return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  }
  // A differenza di GHL (una connessione totale per sede), qui una sede può avere sia una
  // connessione "meta" sia una "google" — il vincolo di unicità è per (sedeId, canale), non per sedeId.
  if (connessioni.some((c) => c.sedeId === sedeId && c.canale === canale && c.attivo)) {
    return NextResponse.json({ error: `Questa sede ha già una connessione ${canale} attiva` }, { status: 409 });
  }

  const connessioneId = `${sedeId}--${canale}`;
  try {
    await creaConnessioneCanale({
      connessioneId,
      sedeId,
      canale,
      accountId: esitoAccountId.valore,
      tipoConversioneLead: body.tipoConversioneLead,
      note: body.note,
    });
    return NextResponse.json({ connessioneId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}

type BodyPatch = {
  connessioneId?: string;
  accountId?: string;
  tipoConversioneLead?: string;
  attivo?: boolean;
  note?: string;
};

export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può modificare le connessioni canale" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const connessioneId = body.connessioneId?.trim();
  if (!connessioneId) {
    return NextResponse.json({ error: "connessioneId obbligatorio" }, { status: 400 });
  }

  const connessioni = await getConnessioniCanale();
  const esistente = connessioni.find((c) => c.connessioneId === connessioneId);
  if (!esistente) {
    return NextResponse.json({ error: "Connessione non trovata" }, { status: 404 });
  }

  let accountIdNormalizzato: string | undefined;
  if (body.accountId !== undefined) {
    const esito = validaAccountId(esistente.canale, body.accountId);
    if (!esito.ok) {
      return NextResponse.json({ error: esito.errore }, { status: 400 });
    }
    accountIdNormalizzato = esito.valore;
  }

  try {
    await aggiornaConnessioneCanale({
      connessioneId,
      accountId: accountIdNormalizzato,
      tipoConversioneLead: body.tipoConversioneLead,
      attivo: body.attivo,
      note: body.note,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
