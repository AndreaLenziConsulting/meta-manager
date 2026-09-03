import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import {
  appendReportOperativita,
  creaAttivitaPerCliente,
  getClienteByAccessCode,
  getClienti,
  getConsulenti,
  getMeetingCliente,
  salvaMeeting,
} from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { campiVisibiliCliente, dataItalianaAIso, generaAttivitaDaMeeting, hashMeetingId } from "@/lib/meeting";
import { buildReportOperativitaRow } from "@/lib/reportOperativita";
import { buildEmailText, separaOggettoECorpo } from "@/lib/meetingEmail";
import { renderMeetingPdfBuffer } from "@/lib/meetingPdf";
import { inviaEmailMeeting } from "@/lib/gmail";
import type { MeetingDataLoose } from "@/types/meeting";

export const runtime = "nodejs";

/**
 * Storico meeting di un cliente. Doppio ramo come /api/kpi:
 * - `code` (cliente pubblico): solo se mostra_tab_extra=TRUE, e SOLO il sottoinsieme filtrato
 *   da campiVisibiliCliente — il filtro è sempre server-side, mai lato client.
 * - `clienteId` + sessione team: righe intere, incluso il dettaglio completo.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const clienteIdParam = searchParams.get("clienteId");

  if (code) {
    const cliente = await getClienteByAccessCode(code);
    if (!cliente || !cliente.attivo) {
      return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
    }
    if (!cliente.mostraTabExtra) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    const tutte = await getMeetingCliente();
    const meeting = tutte
      .filter((m) => m.clienteId === cliente.clienteId)
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((m) => campiVisibiliCliente(m.meetingId, m.data, m.dati));
    return NextResponse.json({ meeting });
  }

  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (!clienteIdParam) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }
  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteIdParam, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  const tutte = await getMeetingCliente();
  const meeting = tutte
    .filter((m) => m.clienteId === clienteIdParam)
    .sort((a, b) => b.data.localeCompare(a.data));
  return NextResponse.json({ meeting });
}

/**
 * Salva (o aggiorna) un meeting confermato dall'anteprima e genera le attività dai suoi
 * actionItems. `creaAttivitaPerCliente` è già idempotente per attivitaId, quindi rigenerare
 * ad ogni salvataggio (anche un aggiornamento) non crea mai righe duplicate.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { clienteId, meeting, inviaEmailAutomatica, testoEmailBozza } = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    meeting?: MeetingDataLoose;
    inviaEmailAutomatica?: boolean;
    testoEmailBozza?: string;
  };
  if (!clienteId || !meeting) {
    return NextResponse.json({ error: "clienteId e meeting sono obbligatori" }, { status: 400 });
  }
  if (!meeting.rawUrl) {
    return NextResponse.json({ error: "Il meeting non ha un url di origine" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  const dataIso = dataItalianaAIso(meeting.date);
  if (!dataIso) {
    return NextResponse.json(
      { error: "Data del meeting non valida — correggila nell'anteprima (formato GG/MM/AAAA)" },
      { status: 422 }
    );
  }

  const meetingId = hashMeetingId(clienteId, meeting.rawUrl);
  const { aggiornato } = await salvaMeeting({
    meetingId,
    clienteId,
    data: dataIso,
    titolo: meeting.title ?? "",
    sentiment: meeting.sentiment ?? "",
    aggiornatoIl: new Date().toISOString(),
    dati: meeting,
  });

  const righeAttivita = generaAttivitaDaMeeting(
    clienteId,
    meetingId,
    dataIso,
    meeting.title ?? "Meeting",
    meeting.actionItems ?? [],
    meeting.taskMese
  );
  await creaAttivitaPerCliente(righeAttivita);

  // Scrittura sul foglio esterno "Report Operatività Clienti" (fuori da questo Sheet), in
  // parallelo allo storico interno. Usa i dati CONFERMATI/editati in anteprima (non quelli
  // grezzi appena estratti) — deviazione intenzionale rispetto a Fast Report, che salvava lì
  // subito dopo l'estrazione grezza. Non bloccante: se fallisce (es. env var non configurata,
  // foglio non raggiungibile), il salvataggio principale sopra resta comunque riuscito.
  const clienteNome = clienti.find((c) => c.clienteId === clienteId)?.nome ?? clienteId;
  try {
    await appendReportOperativita(buildReportOperativitaRow(clienteNome, meeting));
  } catch (err) {
    console.error("Scrittura su Report Operatività fallita (non bloccante):", err);
  }

  // Invio automatico dell'email di follow-up — solo al PRIMO salvataggio (non su una correzione
  // successiva di un meeting già salvato, per non rimandare l'email al cliente ad ogni modifica) e
  // solo se richiesto esplicitamente dalla checkbox in anteprima. Mai bloccante: un fallimento qui
  // (credenziali Gmail non ancora configurate, email cliente/consulente mancante, errore Google)
  // è riportato al chiamante ma il salvataggio del meeting sopra resta comunque riuscito — l'utente
  // può sempre ripiegare sul flusso manuale (scarica PDF / copia email).
  let emailInviata = false;
  let erroreEmail: string | null = null;
  if (!aggiornato && inviaEmailAutomatica) {
    try {
      const cliente = clienti.find((c) => c.clienteId === clienteId);
      if (!cliente?.email) throw new Error("Il cliente non ha un'email configurata");
      const consulente = (await getConsulenti()).find((c) => c.consulenteId === cliente.consulenteId);
      if (!consulente?.email) throw new Error("Il consulente assegnato non ha un'email configurata");

      const { oggetto, corpo } = separaOggettoECorpo(testoEmailBozza ?? buildEmailText(meeting, clienteNome));
      const pdfBuffer = await renderMeetingPdfBuffer(clienteNome, meeting);
      await inviaEmailMeeting({
        consulenteNome: consulente.nome,
        consulenteEmail: consulente.email,
        clienteEmail: cliente.email,
        oggetto,
        corpo,
        allegatoPdf: pdfBuffer,
        nomeAllegato: `report-${clienteNome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.pdf`,
      });
      emailInviata = true;
    } catch (err) {
      erroreEmail = err instanceof Error ? err.message : "Errore sconosciuto nell'invio email";
      console.error("Invio email di follow-up fallito (non bloccante):", err);
    }
  }

  return NextResponse.json({ meetingId, aggiornato, task: righeAttivita.length, emailInviata, erroreEmail });
}
