import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { MeetingReportPdf } from "@/components/MeetingReportPdf";
import type { MeetingDataLoose } from "@/types/meeting";

/**
 * Genera il buffer del PDF brandizzato del report meeting — estratto da
 * `api/meeting/pdf/route.ts` (che ora è solo un thin wrapper) perché serve anche all'invio
 * automatico dell'email di follow-up (src/lib/gmail.ts), non solo al download manuale.
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

export async function renderMeetingPdfBuffer(clienteNome: string, meeting: MeetingDataLoose): Promise<Buffer> {
  const logoBuf = await getLogoBuffer();
  const doc = React.createElement(MeetingReportPdf, { meeting, clienteNome, logoBuf });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(doc as any);
  return Buffer.from(pdfBuffer);
}
