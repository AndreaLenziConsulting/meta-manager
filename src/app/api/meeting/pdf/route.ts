import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getSessione } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { MeetingReportPdf } from "@/components/MeetingReportPdf";
import type { MeetingDataLoose } from "@/types/meeting";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Genera il PDF brandizzato del report meeting (porting di `generate-pdf/route.ts` di Fast
 * Report). Solo contesto team: non esposta al cliente pubblico (`code`).
 */
async function getLogoBuffer(): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    const logoPath = path.join(process.cwd(), "public", "lenzi.webp");
    return await sharp(logoPath).png().toBuffer();
  } catch {
    return null;
  }
}

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
    const logoBuf = await getLogoBuffer();
    const doc = React.createElement(MeetingReportPdf, { meeting, clienteNome, logoBuf });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(doc as any);

    const filename = `report-${(clienteNome || meeting.title || "meeting")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
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
