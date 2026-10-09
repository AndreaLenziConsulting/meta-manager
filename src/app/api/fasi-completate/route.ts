import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getAttivitaCliente, getClienteByAccessCode, getClienti, getFasiCompletate } from "@/lib/archivio";
import { puoVedereCliente } from "@/lib/authz";
import { attivitaDiRoadmap, fasiCompletateRecenti } from "@/lib/roadmap";

export const runtime = "nodejs";

/**
 * Fasi di roadmap completate di recente per un cliente — a differenza di /api/attivita, QUESTA
 * route ha un ramo `code` (stesso schema di /api/kpi): è la sorgente del banner "🎉 Fase
 * completata" mostrato anche al cliente finale nel tab KPI (Fase 1 roadmap, vista milestone).
 * Risponde solo `{ fase, completataIl }` — mai il dettaglio delle attività di quella fase, che
 * resta riservato al team (vedi il commento in SchedaCliente.tsx sul tab Attività).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clienteIdParam = req.nextUrl.searchParams.get("clienteId");

  let clienteId: string;

  if (code) {
    const cliente = await getClienteByAccessCode(code);
    if (!cliente || !cliente.attivo) {
      return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
    }
    clienteId = cliente.clienteId;
  } else {
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
    clienteId = clienteIdParam;
  }

  const [fasi, attivita] = await Promise.all([getFasiCompletate(), getAttivitaCliente()]);
  // Solo le fasi della roadmap del prodotto (vedi faseDiRoadmap in roadmap.ts). Fino al 09/10/2026
  // veniva registrata come tappa anche la "fase" dei compiti di un meeting: quelle righe restano
  // nell'archivio ma non si mostrano più, né al team né al cliente.
  const fasiDelProgetto = new Set(attivita.filter((a) => a.clienteId === clienteId && attivitaDiRoadmap(a)).map((a) => a.fase));
  const recenti = fasiCompletateRecenti(fasi, clienteId)
    .filter((f) => fasiDelProgetto.has(f.fase))
    .map((f) => ({ fase: f.fase, completataIl: f.completataIl }));

  return NextResponse.json({ fasi: recenti });
}
