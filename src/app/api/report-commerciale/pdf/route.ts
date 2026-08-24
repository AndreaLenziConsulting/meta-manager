import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getProspect } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { renderReportCommercialePdfBuffer } from "@/lib/reportCommercialePdf";
import type { ReportCommercialeDataLoose } from "@/types/prospect";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Genera il PDF brandizzato del Report Commerciale — stesso schema di /api/meeting/pdf. Il
 * rendering vero e proprio vive in src/lib/reportCommercialePdf.ts, riusato anche dall'invio email
 * automatico in POST /api/report-commerciale.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { prospectId, report } = (await req.json().catch(() => ({}))) as {
    prospectId?: string;
    report?: ReportCommercialeDataLoose;
  };
  if (!prospectId || !report) {
    return NextResponse.json({ error: "prospectId e report sono obbligatori" }, { status: 400 });
  }

  const prospect = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, prospect)) {
    return NextResponse.json({ error: "Non autorizzato per questo prospect" }, { status: 403 });
  }

  try {
    const pdfBuffer = await renderReportCommercialePdfBuffer(report);
    const filename = `report-${(report.ragioneSociale || report.titolo || "commerciale")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}.pdf`;

    // Buffer implementa Uint8Array (compatibile a runtime con BodyInit) ma TS non lo riconosce
    // qui — stesso attrito di tipizzazione già presente in /api/meeting/pdf.
    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore generazione PDF: ${msg}` }, { status: 500 });
  }
}
