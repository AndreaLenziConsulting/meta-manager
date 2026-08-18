import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { renderMeetingPdfBuffer } from "@/lib/meetingPdf";
import type { MeetingDataLoose } from "@/types/meeting";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Genera il PDF brandizzato del report meeting (porting di `generate-pdf/route.ts` di Fast
 * Report). Solo contesto team: non esposta al cliente pubblico (`code`). Il rendering vero e
 * proprio vive in src/lib/meetingPdf.ts, riusato anche dall'invio email automatico.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { clienteId, meeting } = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    meeting?: MeetingDataLoose;
  };
  if (!clienteId || !meeting) {
    return NextResponse.json({ error: "clienteId e meeting sono obbligatori" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }
  const clienteNome = clienti.find((c) => c.clienteId === clienteId)?.nome ?? clienteId;

  try {
    const pdfBuffer = await renderMeetingPdfBuffer(clienteNome, meeting);
    const filename = `report-${(clienteNome || meeting.title || "meeting")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}.pdf`;

    // Buffer implementa Uint8Array (compatibile a runtime con BodyInit) ma TS non lo riconosce
    // qui — stesso attrito di tipizzazione di react-pdf già presente sopra (doc as any).
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
