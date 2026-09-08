import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { creaAttivitaPerCliente, getAttivitaCliente, getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { generaTaskIdManuale } from "@/lib/accessCode";
import { oggiIso } from "@/lib/roadmap";

export const runtime = "nodejs";

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Aggiunge manualmente una singola attività alla roadmap di un cliente — a differenza di
 * /api/attivita/genera (template prodotto, admin-only, tutta la roadmap in un colpo) o della
 * generazione automatica dai meeting (generaAttivitaDaMeeting in lib/meeting.ts), questa è
 * un'aggiunta libera, un task alla volta. Stessa autenticazione di stato/scadenza/elimina in questa
 * stessa cartella (sessione + puoVedereCliente, NON admin-only): gestire il giorno per giorno della
 * roadmap di un proprio cliente è già un'azione che il consulente può fare, aggiungere un task ad
 * hoc non è diverso da cambiarne lo stato o la scadenza.
 *
 * `fase` è testo libero (non un id): il chiamante suggerisce le fasi già presenti nella roadmap del
 * cliente (autocomplete lato UI), ma può anche digitarne una nuova — un'attività aggiunta a mano
 * finisce più spesso in una fase già in corso che in una nuova lane dedicata. `ordine` = il
 * successivo assoluto sull'intero foglio (mai un secondo scan per-fase): risultato pratico, dentro
 * la fase scelta il nuovo task va sempre in fondo, che è esattamente il comportamento voluto.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    descrizione?: string;
    fase?: string;
    responsabile?: string;
    dataInizio?: string;
    dataFine?: string;
    notaTeam?: string;
  };
  const clienteId = body.clienteId?.trim();
  const descrizione = body.descrizione?.trim();
  const fase = body.fase?.trim();
  const dataFine = body.dataFine?.trim();
  const dataInizio = body.dataInizio?.trim() || oggiIso();

  if (!clienteId || !descrizione || !fase || !dataFine) {
    return NextResponse.json({ error: "clienteId, descrizione, fase e dataFine sono obbligatori" }, { status: 400 });
  }
  if (!DATA_ISO_RE.test(dataFine) || !DATA_ISO_RE.test(dataInizio)) {
    return NextResponse.json({ error: "Data non valida (formato atteso GGGG-MM-GG)" }, { status: 400 });
  }
  if (dataFine < dataInizio) {
    return NextResponse.json({ error: "La scadenza non può essere prima della data di inizio" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  const tutte = await getAttivitaCliente();
  const attivitaCliente = tutte.filter((a) => a.clienteId === clienteId);
  const taskId = generaTaskIdManuale(descrizione, new Set(attivitaCliente.map((a) => a.taskId)));
  const ordine = tutte.reduce((max, a) => Math.max(max, a.ordine), 0) + 1;

  try {
    await creaAttivitaPerCliente([
      {
        attivitaId: `${clienteId}::${taskId}`,
        clienteId,
        prodottoId: "manuale",
        taskId,
        blocco: "manuale",
        fase,
        descrizione,
        responsabile: body.responsabile?.trim() || "Da assegnare",
        tipo: "",
        dataInizio,
        dataFine,
        stato: "todo",
        notaTeam: body.notaTeam?.trim() ?? "",
        ordine,
      },
    ]);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
