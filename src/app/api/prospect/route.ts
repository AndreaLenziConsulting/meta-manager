import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { creaProspect, getCommerciali, getProspect } from "@/lib/sheets";
import { generaProspectId } from "@/lib/accessCode";

export const runtime = "nodejs";

type Body = {
  ragioneSociale?: string;
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;
  email?: string;
  // Solo per l'admin: quale commerciale possiede il prospect (per un commerciale è sempre e solo
  // sé stesso, vedi sotto — il campo qui viene ignorato in quel caso).
  commercialeId?: string;
};

/**
 * Crea un nuovo prospect. Un commerciale lo assegna sempre a sé stesso (comportamento originale,
 * invariato); l'admin può crearne uno per conto di un commerciale specifico, scelto esplicitamente
 * nel form (mai un default implicito: un prospect senza commerciale assegnato non comparirebbe a
 * nessuno in prospectVisibili).
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "commerciale" && sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo un commerciale o l'amministratore possono creare un prospect" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const ragioneSociale = body.ragioneSociale?.trim();
  if (!ragioneSociale) {
    return NextResponse.json({ error: "Ragione sociale obbligatoria" }, { status: 400 });
  }

  let commercialeId: string;
  if (sessione.ruolo === "commerciale") {
    if (!sessione.commercialeId) {
      return NextResponse.json({ error: "Sessione commerciale non valida" }, { status: 401 });
    }
    commercialeId = sessione.commercialeId;
  } else {
    const richiesto = body.commercialeId?.trim();
    if (!richiesto) {
      return NextResponse.json({ error: "Commerciale di riferimento obbligatorio" }, { status: 400 });
    }
    const commerciali = await getCommerciali();
    if (!commerciali.some((c) => c.commercialeId === richiesto && c.attivo)) {
      return NextResponse.json({ error: "Commerciale non valido" }, { status: 400 });
    }
    commercialeId = richiesto;
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
      commercialeId,
      creatoIl: new Date().toISOString(),
    });
    return NextResponse.json({ prospectId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}
