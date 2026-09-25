import { NextRequest, NextResponse } from "next/server";
import { verifyGhlWebhookSecret } from "@/lib/auth";
import { getCommerciali, getProspect } from "@/lib/sheets";
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
 * Deduplica per email (22/09/2026, richiesta utente: "quando viene fissato un PRIMO appuntamento"
 * — un secondo appuntamento dello stesso contatto non deve generare un secondo prospect): se arriva
 * un `email` che combacia (case-insensitive, trim) con un prospect già esistente, non se ne crea uno
 * nuovo — torna l'id di quello già a sistema con 200 invece di 201. Solo per email: `ragioneSociale`
 * non è un identificatore stabile (due aziende omonime, o la stessa scritta in modo leggermente
 * diverso da GHL). Senza `email` nel payload (campo opzionale) la deduplica non è possibile — si
 * crea comunque un nuovo prospect, stesso comportamento di prima. MAI un merge automatico dei dati
 * già raccolti sul prospect esistente: solo salta la creazione, il commerciale aggiorna a mano se
 * serve (stesso principio già in uso per il form di creazione manuale).
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

  const email = body.email?.trim();

  try {
    if (email) {
      const emailNorm = email.toLowerCase();
      const esistente = (await getProspect()).find((p) => p.email.trim().toLowerCase() === emailNorm);
      if (esistente) {
        return NextResponse.json({ ok: true, prospectId: esistente.prospectId, duplicato: true }, { status: 200 });
      }
    }

    const prospectId = await creaProspectConCartellaDrive({ ragioneSociale, nomeContatto, email, commercialeId }, commerciali);
    return NextResponse.json({ ok: true, prospectId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }
}
