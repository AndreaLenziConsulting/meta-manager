import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaProspect, creaProspect, getCommerciali, getProspect } from "@/lib/sheets";
import { generaProspectId } from "@/lib/accessCode";
import { puoVedereProspect } from "@/lib/authz";

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

type BodyPatch = {
  prospectId?: string;
  driveFolderUrl?: string;
  mediaBudgetMensile?: number | null;
  targetCpl?: number | null;
  targetCpaAppuntamento?: number | null;
  targetLeadSettimana?: number | null;
  targetAppuntamentiSettimana?: number | null;
  targetFatturatoMensile?: number | null;
  targetMargineVenditaPct?: number | null;
};

const CAMPI_NUMERICI = [
  "mediaBudgetMensile",
  "targetCpl",
  "targetCpaAppuntamento",
  "targetLeadSettimana",
  "targetAppuntamentiSettimana",
  "targetFatturatoMensile",
  "targetMargineVenditaPct",
] as const;

/**
 * Modifica i dati commerciali di un prospect esistente (cartella Drive + parametri target, vedi
 * types/prospect.ts) — l'anagrafica vera e propria (ragioneSociale/tipoBusiness/fatturato/sedi)
 * resta gestita solo dall'estrazione automatica del report (vedi POST /api/report-commerciale),
 * non da questa route. Un commerciale può modificare solo i propri prospect, l'admin qualsiasi.
 */
export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "commerciale" && sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo un commerciale o l'amministratore possono modificare un prospect" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const prospectId = body.prospectId?.trim();
  if (!prospectId) {
    return NextResponse.json({ error: "prospectId obbligatorio" }, { status: 400 });
  }

  const tutti = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, tutti)) {
    return NextResponse.json({ error: "Prospect non trovato" }, { status: 404 });
  }

  for (const campo of CAMPI_NUMERICI) {
    const v = body[campo];
    if (v !== undefined && v !== null && !Number.isFinite(v)) {
      return NextResponse.json({ error: `${campo} non valido` }, { status: 400 });
    }
  }
  if (body.targetMargineVenditaPct != null && (body.targetMargineVenditaPct < 0 || body.targetMargineVenditaPct > 100)) {
    return NextResponse.json({ error: "targetMargineVenditaPct deve essere tra 0 e 100" }, { status: 400 });
  }

  try {
    await aggiornaProspect({
      prospectId,
      driveFolderUrl: body.driveFolderUrl !== undefined ? body.driveFolderUrl.trim() : undefined,
      mediaBudgetMensile: body.mediaBudgetMensile,
      targetCpl: body.targetCpl,
      targetCpaAppuntamento: body.targetCpaAppuntamento,
      targetLeadSettimana: body.targetLeadSettimana,
      targetAppuntamentiSettimana: body.targetAppuntamentiSettimana,
      targetFatturatoMensile: body.targetFatturatoMensile,
      targetMargineVenditaPct: body.targetMargineVenditaPct,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nel salvataggio" }, { status: 502 });
  }
}
