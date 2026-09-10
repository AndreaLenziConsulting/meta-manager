import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti, getMeetingCliente } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * Meeting di TUTTI i clienti visibili alla sessione corrente (tutti per l'admin, solo i propri per
 * il consulente) — mirror di GET /api/attivita/tutte, stessa architettura: alimenta la vista
 * aggregata "Meeting" nel menù laterale. Nessun ramo `code` (link pubblico), a differenza di
 * GET /api/meeting (un cliente alla volta): il sentiment non è mai un dato da mostrare al cliente
 * finale, stesso motivo per cui AndamentoSentiment è gated su clienteId in MeetingTab.tsx.
 *
 * `clienti` include TUTTI i visibili, anche quelli senza nessun meeting salvato — serve alla UI per
 * distinguere "0 clienti assegnati" da "clienti assegnati ma senza meeting", per risolvere il
 * badge nome-cliente per id su ogni riga, e (09/09/2026, caricamento registrazione anche dal menù
 * generale) per il select cliente di NuovoMeetingForm.tsx — `email` inclusa lì per lo stesso motivo
 * per cui serve in MeetingTab.tsx: default/etichetta della checkbox invio automatico una volta
 * scelto il cliente. `meeting` ordinati per data decrescente (il più recente prima): a differenza
 * di /api/attivita/tutte (nessun ordine imposto, la UI raggruppa per stato), qui l'ordine
 * cronologico inverso è la lettura naturale di un elenco di appuntamenti.
 */
export async function GET() {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const tuttiClienti = await getClienti();
  const visibili = clientiVisibili(sessione, tuttiClienti);
  const idVisibili = new Set(visibili.map((c) => c.clienteId));

  const tuttiMeeting = await getMeetingCliente();
  const meeting = tuttiMeeting.filter((m) => idVisibili.has(m.clienteId)).sort((a, b) => b.data.localeCompare(a.data));

  return NextResponse.json({
    clienti: visibili.map((c) => ({ clienteId: c.clienteId, nome: c.nome, email: c.email })),
    meeting,
  });
}
