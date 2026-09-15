import { NextRequest, NextResponse } from "next/server";
import { verifyGhlWebhookSecret } from "@/lib/auth";
import { getCommerciali } from "@/lib/sheets";
import { creaProspectConCartellaDrive } from "@/lib/prospectCreazione";

export const runtime = "nodejs";

/**
 * Crea in automatico un prospect al fissaggio di un appuntamento sul calendario di vendita ALC
 * (richiesta utente 11/2026) — chiamato da un'Azione Webhook di un Workflow GHL, mai da un utente
 * loggato: autenticazione a parte (header Authorization: Bearer, vedi verifyGhlWebhookSecret),
 * nessuna sessione.
 *
 * Contratto del corpo JSON che il Workflow GHL deve inviare (da configurare a mano nell'azione
 * Webhook del Workflow, mappando i merge field del contatto/appuntamento su questi nomi esatti —
 * GHL non ha un payload webhook fisso, il corpo lo si scrive lì):
 * {
 *   "ragioneSociale": "{{contact.company_name}}",   // fallback su nomeContatto se assente/vuoto
 *   "nomeContatto": "{{contact.full_name}}",
 *   "email": "{{contact.email}}",
 *   "commercialeId": "stefano"                        // valore FISSO impostato nel Workflow, non
 *                                                       // un merge field — un Workflow per calendario
 *                                                       // /commerciale, così questa route non deve
 *                                                       // indovinare a chi assegnare il prospect
 * }
 * Un secondo giro di webhook con la stessa azienda crea un prospect distinto (nessuna deduplica
 * per nome): un appuntamento ripetuto per lo stesso prospect già a sistema va gestito a mano dal
 * commerciale (stesso comportamento del form di creazione manuale, mai un merge automatico che
 * rischierebbe di sovrascrivere dati già raccolti).
 */
export async function POST(req: NextRequest) {
  if (!verifyGhlWebhookSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    ragioneSociale?: string;
    nomeContatto?: string;
    email?: string;
    commercialeId?: string;
  };

  const nomeContatto = body.nomeContatto?.trim();
  const ragioneSociale = body.ragioneSociale?.trim() || nomeContatto;
  if (!ragioneSociale) {
    return NextResponse.json({ error: "ragioneSociale o nomeContatto obbligatorio" }, { status: 400 });
  }

  const commercialeId = body.commercialeId?.trim();
  if (!commercialeId) {
    return NextResponse.json({ error: "commercialeId obbligatorio" }, { status: 400 });
  }
  const commerciali = await getCommerciali();
  if (!commerciali.some((c) => c.commercialeId === commercialeId && c.attivo)) {
    return NextResponse.json({ error: "commercialeId non valido" }, { status: 400 });
  }

  try {
    const prospectId = await creaProspectConCartellaDrive(
      { ragioneSociale, nomeContatto, email: body.email?.trim(), commercialeId },
      commerciali
    );
    return NextResponse.json({ ok: true, prospectId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}
