import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienteByAccessCode, getClienti, getSedi } from "@/lib/archivio";
import { puoVedereCliente } from "@/lib/authz";
import { fetchFrequenzaPerCampagna } from "@/lib/meta";
import { normalizzaIntervallo } from "@/lib/kpi";
import type { Sede } from "@/types/kpi";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Frequenza per campagna (blocco 7 del redesign KPI), letta LIVE sull'intero periodo richiesto —
 * mai sincronizzata/salvata nel foglio insieme al resto di MetaDaily, vedi il commento su
 * fetchFrequenzaPerCampagna in lib/meta.ts (reach non è sommabile/mediabile su righe giornaliere).
 * Stesso schema di autenticazione di /api/kpi (ramo `code` pubblico o sessione+clienteId interna).
 * Resiliente: se Meta non risponde, 200 con mappa vuota — mai un errore che rompe il resto della
 * pagina (la colonna Frequenza mostra "dato non disponibile", quella campagna non contribuisce
 * alla regola frequenza-alta del blocco 4/7, mai un falso verde).
 *
 * `da`/`a`: un mese ("YYYY-MM") o un giorno ("YYYY-MM-DD"), normalizzati come in /api/kpi — prima
 * del 01/10/2026 questa route assumeva sempre un mese e, col selettore periodo a giorni, costruiva
 * date non valide (Meta rifiutava la chiamata e la colonna Frequenza restava vuota in silenzio).
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const clienteIdParam = searchParams.get("clienteId");
  const sedeIdParam = searchParams.get("sedeId");
  const { da: since, a: until } = normalizzaIntervallo(searchParams.get("da") || meseCorrente(), searchParams.get("a") || meseCorrente());

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

  const tutteLeSedi = await getSedi();
  const sediCliente = tutteLeSedi.filter((s) => s.clienteId === clienteId && s.attivo);
  if (sediCliente.length === 0) {
    return NextResponse.json({ error: "Nessuna sede attiva per questo cliente" }, { status: 404 });
  }
  const sede = (sedeIdParam && sediCliente.find((s: Sede) => s.sedeId === sedeIdParam)) || sediCliente[0];

  if (!sede.adAccountId) {
    return NextResponse.json({ frequenzaPerCampagna: {} });
  }

  try {
    const mappa = await fetchFrequenzaPerCampagna(sede.adAccountId, since, until);
    return NextResponse.json({ frequenzaPerCampagna: Object.fromEntries(mappa) });
  } catch {
    // Vedi il docblock sopra: mai un errore qui, la frequenza è un'informazione accessoria.
    return NextResponse.json({ frequenzaPerCampagna: {} });
  }
}
