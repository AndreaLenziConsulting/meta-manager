import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaStatoAttivita, getAttivitaCliente, getClienti, registraFaseCompletata } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { faseCompletata, oggiIso } from "@/lib/roadmap";
import type { StatoAttivita } from "@/types/kpi";

export const runtime = "nodejs";

const STATI_VALIDI: StatoAttivita[] = ["todo", "wip", "done", "blocked"];

export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    attivitaId?: string;
    stato?: string;
    notaTeam?: string;
  };
  const { clienteId, attivitaId, stato, notaTeam } = body;

  if (!clienteId || !attivitaId || !stato) {
    return NextResponse.json({ error: "clienteId, attivitaId e stato sono obbligatori" }, { status: 400 });
  }
  if (!STATI_VALIDI.includes(stato as StatoAttivita)) {
    return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }
  if (stato === "blocked" && !notaTeam?.trim()) {
    return NextResponse.json({ error: "Il motivo del blocco è obbligatorio" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  // Non ci si affida solo alla convenzione di naming attivitaId = "${clienteId}::${taskId}":
  // si verifica che la riga esista davvero e appartenga al cliente richiesto.
  const attivita = await getAttivitaCliente();
  const riga = attivita.find((a) => a.attivitaId === attivitaId);
  if (!riga || riga.clienteId !== clienteId) {
    return NextResponse.json({ error: "Attività non trovata per questo cliente" }, { status: 404 });
  }

  // Stato della fase PRIMA dell'aggiornamento — serve solo a rilevare la transizione "non
  // completa -> completa" più sotto, calcolata sui dati già in memoria (nessuna rilettura extra).
  const stessaFasePrima = attivita.filter((a) => a.clienteId === clienteId && a.fase === riga.fase);
  const completataPrima = faseCompletata(stessaFasePrima);

  try {
    await aggiornaStatoAttivita(attivitaId, stato as StatoAttivita, notaTeam?.trim());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }

  // "Tappa raggiunta" (vista milestone, Fase 1 roadmap): solo sulla transizione, mai su ogni save
  // — simula lo stato dopo l'aggiornamento senza rileggere il foglio (stessa lista, un solo campo
  // sostituito). Non bloccante: un errore qui non deve far fallire l'aggiornamento dello stato,
  // che è già andato a buon fine sopra — stesso principio di appendReportOperativita.
  const stessaFaseDopo = stessaFasePrima.map((a) => (a.attivitaId === attivitaId ? { ...a, stato: stato as StatoAttivita } : a));
  if (!completataPrima && faseCompletata(stessaFaseDopo)) {
    try {
      await registraFaseCompletata(clienteId, riga.fase, oggiIso());
    } catch {
      // Non bloccante: la fase resta comunque completata anche se la notifica fallisce a registrarsi.
    }
  }

  return NextResponse.json({ ok: true });
}
