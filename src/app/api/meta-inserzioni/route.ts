import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getCampagne, getClienteByAccessCode, getClienti, getSedi } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { fetchAnagraficaInserzioni, fetchInserzioniPerCampagna } from "@/lib/meta";
import { normalizzaIntervallo } from "@/lib/kpi";
import type { AnagraficaInserzioneFuoriPeriodo } from "@/lib/inserzioniOutlier";
import type { Sede } from "@/types/kpi";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Spesa+lead+stato per inserzione (ad), letti LIVE sull'intero periodo richiesto — mai
 * sincronizzati/salvati nel foglio, vedi il commento su fetchInserzioniPerCampagna in lib/meta.ts.
 * Ritorna i dati grezzi per inserzione: è il chiamante (KpiSection.tsx, useMemo con
 * trovaInserzioniOutlier) a decidere quali sono outlier rispetto al target CPL della sede — stesso
 * schema di /api/meta-frequenza (dati grezzi qui, soglia applicata lato client). Stessa
 * autenticazione di /api/kpi (ramo `code` pubblico o sessione+clienteId interna).
 *
 * Resiliente: se Meta non risponde, 200 con array vuoto — mai un errore che rompe il resto della
 * pagina (nessun avviso "inserzioni outlier" quel giro, mai un falso negativo mostrato come dato).
 * In quel caso la risposta porta anche `errore: true`: la vista "Per singola inserzione" del
 * Dettaglio (01/10/2026) deve poter distinguere "nessuna inserzione ha speso nel periodo" da "Meta
 * non ha risposto", mai una tabella vuota spacciata per un dato.
 *
 * `da`/`a`: un mese ("YYYY-MM") o un giorno ("YYYY-MM-DD"), normalizzati come in /api/kpi — prima
 * del 01/10/2026 questa route assumeva sempre un mese e, col selettore periodo a giorni, costruiva
 * date non valide (Meta rifiutava la chiamata e la risposta restava vuota in silenzio).
 *
 * `anagrafica=1` (solo richiesta interna, mai su `code`): aggiunge `altreInserzioni`, nome/campagna/
 * stato delle inserzioni dell'account che NON hanno speso nel periodo — servono solo a dare un nome
 * alle righe a cui GHL attribuisce un risultato del periodo (vedi fetchAnagraficaInserzioni in
 * lib/meta.ts). Il chiamante lo chiede solo per le sedi connesse a GHL.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const clienteIdParam = searchParams.get("clienteId");
  const sedeIdParam = searchParams.get("sedeId");
  const { da: since, a: until } = normalizzaIntervallo(searchParams.get("da") || meseCorrente(), searchParams.get("a") || meseCorrente());
  const conAnagrafica = searchParams.get("anagrafica") === "1" && !code;

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
    return NextResponse.json({ inserzioni: [] });
  }

  try {
    const [aggregate, anagrafica] = await Promise.all([
      fetchInserzioniPerCampagna(sede.adAccountId, since, until, sede.tipoConversioneLead || undefined),
      fetchAnagraficaInserzioni(sede.adAccountId),
    ]);
    const inserzioni = aggregate.map((i) => ({ ...i, stato: anagrafica.get(i.adId)?.stato || "" }));
    if (!conAnagrafica) return NextResponse.json({ inserzioni });

    // Nome campagna dal foglio Campagne (già in cache), non da una seconda chiamata Meta: "" se la
    // campagna non è mai stata sincronizzata in app — il chiamante mostra solo il nome inserzione.
    const nomeCampagna = new Map(
      (await getCampagne()).filter((c) => c.clienteId === clienteId).map((c) => [c.campaignId, c.nomeCampagna])
    );
    const nelPeriodo = new Set(aggregate.map((i) => i.adId));
    const altreInserzioni: Record<string, AnagraficaInserzioneFuoriPeriodo> = {};
    for (const [adId, info] of anagrafica) {
      if (nelPeriodo.has(adId)) continue;
      altreInserzioni[adId] = { ...info, nomeCampagna: nomeCampagna.get(info.campaignId) ?? "" };
    }
    return NextResponse.json({ inserzioni, altreInserzioni });
  } catch {
    // Vedi il docblock sopra: mai un errore qui, le inserzioni outlier sono un'informazione accessoria.
    return NextResponse.json({ inserzioni: [], errore: true });
  }
}
