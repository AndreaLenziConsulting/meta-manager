import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { creaProspect, getProspect } from "@/lib/sheets";
import { generaProspectId } from "@/lib/accessCode";

export const runtime = "nodejs";

type Body = {
  ragioneSociale?: string;
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;
  email?: string;
};

/** Crea un nuovo prospect, sempre assegnato al commerciale che lo crea. Solo ruolo commerciale. */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "commerciale" || !sessione.commercialeId) {
    return NextResponse.json({ error: "Solo un commerciale può creare un prospect" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const ragioneSociale = body.ragioneSociale?.trim();
  if (!ragioneSociale) {
    return NextResponse.json({ error: "Ragione sociale obbligatoria" }, { status: 400 });
  }

  const esistenti = await getProspect();
  const prospectId = generaProspectId(ragioneSociale, new Set(esistenti.map((p) => p.prospectId)));

  try {
    await creaProspect({
      prospectId,
      ragioneSociale,
      tipoBusiness: body.tipoBusiness?.trim(),
      fatturato: body.fatturato?.trim(),
      sedi: body.sedi?.trim(),
      email: body.email?.trim(),
      commercialeId: sessione.commercialeId,
      creatoIl: new Date().toISOString(),
    });
    return NextResponse.json({ prospectId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}
