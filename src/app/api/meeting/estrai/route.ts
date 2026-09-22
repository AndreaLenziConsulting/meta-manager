import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti, getConsulenti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { estraiMeetingData, EstrazioneError } from "@/lib/estrazione";

// Titolo letterale che Google Meet assegna a una call avviata senza un evento calendario — Fathom/
// Circleback lo importano così com'è, mai un titolo scelto da nessuno. Confrontato case-insensitive
// e trim perché non c'è garanzia che la piattaforma lo restituisca sempre con lo stesso casing.
const TITOLO_GOOGLE_MEET_SENZA_NOME = "impromptu google meet meeting";

export const runtime = "nodejs";
// Scraping Playwright + chiamata Groq, entrambi ora con un retry (vedi estrazione.ts — Fathom
// mostra a volte un errore di rete transitorio, Groq a volte tool_use_failed anche su contenuto
// buono). Nel caso peggiore: 2 caricamenti pagina + 2 chiamate Groq, quindi margine più ampio
// dei 90s originali di Fast Report (che non aveva retry).
export const maxDuration = 150;
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
    const { dati, troncamento } = await estraiMeetingData(url);

    // Referente: MAI dedotto dalla registrazione (vedi estrazione.ts) — il cliente/consulente
    // assegnato sono già noti da qui (clienteId arriva dal contesto), stesso principio già in uso
    // per `cliente` (vedi types/meeting.ts). "" se il cliente non ha un consulente assegnato:
    // meglio vuoto che un nome sbagliato, l'admin lo compila a mano nell'anteprima se serve.
    const cliente = clienti.find((c) => c.clienteId === clienteId);
    const consulente = cliente ? (await getConsulenti()).find((c) => c.consulenteId === cliente.consulenteId) : undefined;
    dati.referente = consulente?.nome ?? "";

    // Titolo di default per le call Google Meet avviate senza invito calendario (vedi
    // TITOLO_GOOGLE_MEET_SENZA_NOME sopra) — sostituito con qualcosa di leggibile nello storico
    // meeting invece del titolo tecnico di Google Meet, che non dice né il cliente né quando.
    if (dati.title?.trim().toLowerCase() === TITOLO_GOOGLE_MEET_SENZA_NOME && cliente) {
      const data = dati.dataConsulenza || dati.date || "";
      dati.title = `Follow-up meeting — ${cliente.nome}${data ? ` (${data})` : ""}`;
    }

    return NextResponse.json({ dati, troncamento });
  } catch (err) {
    if (err instanceof EstrazioneError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
