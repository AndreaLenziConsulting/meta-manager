import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaProspect, getCommerciali, getProspect, getReportCommerciale, salvaReportCommerciale } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { dataItalianaAIso } from "@/lib/meeting";
import { hashReportId } from "@/lib/prospect";
import { buildEmailTextCommerciale, separaOggettoECorpo } from "@/lib/reportCommercialeEmail";
import { renderReportCommercialePdfBuffer } from "@/lib/reportCommercialePdf";
import { inviaEmailMeeting } from "@/lib/gmail";
import type { ReportCommercialeDataLoose } from "@/types/prospect";

export const runtime = "nodejs";

/** Storico report di un prospect. Solo contesto team (commerciale/admin) — nessun link pubblico. */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const prospectId = req.nextUrl.searchParams.get("prospectId");
  if (!prospectId) {
    return NextResponse.json({ error: "prospectId mancante" }, { status: 400 });
  }
  const prospect = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, prospect)) {
    return NextResponse.json({ error: "Non autorizzato per questo prospect" }, { status: 403 });
  }

  const tutti = await getReportCommerciale();
  const report = tutti.filter((r) => r.prospectId === prospectId).sort((a, b) => b.data.localeCompare(a.data));
  return NextResponse.json({ report });
}

/**
 * Salva (o aggiorna) un report confermato dall'anteprima, e allinea i 4 campi anagrafici del
 * prospect a quanto risulta nel report — così non vanno re-inseriti al report successivo.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { prospectId, report, inviaEmailAutomatica, testoEmailBozza } = (await req.json().catch(() => ({}))) as {
    prospectId?: string;
    report?: ReportCommercialeDataLoose;
    inviaEmailAutomatica?: boolean;
    testoEmailBozza?: string;
  };
  if (!prospectId || !report) {
    return NextResponse.json({ error: "prospectId e report sono obbligatori" }, { status: 400 });
  }
  if (!report.rawUrl) {
    return NextResponse.json({ error: "Il report non ha un url di origine" }, { status: 400 });
  }

  const tuttiProspect = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, tuttiProspect)) {
    return NextResponse.json({ error: "Non autorizzato per questo prospect" }, { status: 403 });
  }
  const prospect = tuttiProspect.find((p) => p.prospectId === prospectId)!;

  const dataIso = dataItalianaAIso(report.data);
  if (!dataIso) {
    return NextResponse.json(
      { error: "Data della chiamata non valida — correggila nell'anteprima (formato GG/MM/AAAA)" },
      { status: 422 }
    );
  }

  const reportId = hashReportId(prospectId, report.rawUrl);
  const { aggiornato } = await salvaReportCommerciale({
    reportId,
    prospectId,
    commercialeId: prospect.commercialeId,
    data: dataIso,
    aggiornatoIl: new Date().toISOString(),
    dati: report,
  });

  // Allinea l'anagrafica persistente del prospect a quanto risulta in questo report — vedi
  // memoria di progetto: evita di dover re-inserire ragione sociale/tipo business/fatturato/sedi
  // al report successivo. Non bloccante: un fallimento qui non deve far sembrare fallito il
  // salvataggio del report sopra, che è già andato a buon fine.
  try {
    await aggiornaProspect({
      prospectId,
      ragioneSociale: report.ragioneSociale,
      tipoBusiness: report.tipoBusiness,
      fatturato: report.fatturato,
      sedi: report.sedi,
    });
  } catch (err) {
    console.error("Aggiornamento anagrafica prospect fallito (non bloccante):", err);
  }

  // Invio automatico dell'email di follow-up — solo al PRIMO salvataggio, stessa logica di
  // POST /api/meeting: mai bloccante, un fallimento è riportato al chiamante ma il salvataggio
  // del report resta comunque riuscito.
  let emailInviata = false;
  let erroreEmail: string | null = null;
  if (!aggiornato && inviaEmailAutomatica) {
    try {
      if (!prospect.email) throw new Error("Il prospect non ha un'email configurata");
      const commerciale = (await getCommerciali()).find((c) => c.commercialeId === prospect.commercialeId);
      if (!commerciale?.email) throw new Error("Il commerciale assegnato non ha un'email configurata");

      const { oggetto, corpo } = separaOggettoECorpo(
        testoEmailBozza ?? buildEmailTextCommerciale(report, prospect.ragioneSociale, commerciale.nome)
      );
      const pdfBuffer = await renderReportCommercialePdfBuffer(report);
      await inviaEmailMeeting({
        consulenteNome: commerciale.nome,
        consulenteEmail: commerciale.email,
        clienteEmail: prospect.email,
        oggetto,
        corpo,
        allegatoPdf: pdfBuffer,
        nomeAllegato: `report-${prospect.ragioneSociale.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.pdf`,
      });
      emailInviata = true;
    } catch (err) {
      erroreEmail = err instanceof Error ? err.message : "Errore sconosciuto nell'invio email";
      console.error("Invio email di follow-up commerciale fallito (non bloccante):", err);
    }
  }

  return NextResponse.json({ reportId, aggiornato, emailInviata, erroreEmail });
}
