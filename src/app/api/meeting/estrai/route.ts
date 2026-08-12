import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { estraiMeetingData, EstrazioneError } from "@/lib/estrazione";

export const runtime = "nodejs";
// Scraping Playwright + chiamata Groq: stesso valore usato in Fast Report per la stessa
// pipeline (90s), qui con un margine minimo aggiuntivo.
export const maxDuration = 100;
// Chromium serverless ha bisogno di ~500MB+; stesso valore già in uso per lo stesso scraping.
export const memory = 3008;

/**
 * Estrae i dati di un meeting da un link pubblico (Fathom/Circleback/Loom) via scraping +
 * Groq. Non salva nulla: torna il MeetingData grezzo per l'anteprima; il salvataggio vero
 * avviene solo con POST /api/meeting dopo conferma dell'utente.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { clienteId, url } = (await req.json().catch(() => ({}))) as { clienteId?: string; url?: string };
  if (!clienteId || !url) {
    return NextResponse.json({ error: "clienteId e url sono obbligatori" }, { status: 400 });
  }
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "URL non valido" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  try {
    const meeting = await estraiMeetingData(url);
    return NextResponse.json(meeting);
  } catch (err) {
    if (err instanceof EstrazioneError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
