import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getProspect } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { EstrazioneError } from "@/lib/estrazione";
import { estraiReportCommerciale } from "@/lib/estrazioneCommerciale";

export const runtime = "nodejs";
// Scraping Playwright fino a 3 tentativi (uno in più di /api/meeting/estrai, vedi
// estrazioneCommerciale.ts) + Groq con un retry — budget alzato di conseguenza.
export const maxDuration = 200;
export const memory = 3008;

/**
 * Estrae i dati di un report commerciale da un link pubblico (Fathom/Circleback/Loom). Non salva
 * nulla: torna il ReportCommercialeDataLoose grezzo per l'anteprima, il salvataggio vero avviene
 * solo con POST /api/report-commerciale dopo conferma dell'utente — stesso schema di /api/meeting/estrai.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { prospectId, url } = (await req.json().catch(() => ({}))) as { prospectId?: string; url?: string };
  if (!prospectId || !url) {
    return NextResponse.json({ error: "prospectId e url sono obbligatori" }, { status: 400 });
  }
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "URL non valido" }, { status: 400 });
  }

  const prospect = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, prospect)) {
    return NextResponse.json({ error: "Non autorizzato per questo prospect" }, { status: 403 });
  }

  try {
    const report = await estraiReportCommerciale(url);
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof EstrazioneError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
