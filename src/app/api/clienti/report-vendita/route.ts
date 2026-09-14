import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti, getProspect, getReportCommerciale } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * Storico dei report commerciali del prospect che si è convertito in questo cliente — sola
 * lettura, per il tab "Vendita" della scheda cliente (ReportVenditaTab.tsx). Include il
 * Calcolatore Budget compilato dal commerciale prima della vendita (ticket medio, margine, CPL,
 * tassi, piano annuale), altrimenti invisibile al consulente: prospectVisibili/puoVedereProspect
 * (authz.ts) non gestiscono affatto il ruolo consulente, quindi oggi non ha nessun accesso al
 * prospect stesso. Deliberatamente un endpoint a parte invece di allargare puoVedereProspect: qui
 * serve solo lettura per chi vede già il cliente (gate su puoVedereCliente, già consapevole del
 * ruolo consulente), mai le azioni di modifica/eliminazione che l'endpoint prospect espone a
 * commerciale/admin.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  // Un cliente pre-esistente (mai passato dal flusso prospect) semplicemente non ha un prospect
  // collegato — nessun errore, solo uno storico vuoto: ReportVenditaTab.tsx mostra uno stato vuoto.
  const prospetti = await getProspect();
  const prospect = prospetti.find((p) => p.clienteId === clienteId);
  if (!prospect) {
    return NextResponse.json({ report: [] });
  }

  const tutti = await getReportCommerciale();
  const report = tutti.filter((r) => r.prospectId === prospect.prospectId).sort((a, b) => b.data.localeCompare(a.data));
  return NextResponse.json({ report });
}
