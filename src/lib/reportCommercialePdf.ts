import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportCommercialePdf } from "@/components/ReportCommercialePdf";
import type { ReportCommercialeDataLoose } from "@/types/prospect";

/**
 * Genera il buffer del PDF brandizzato del Report Commerciale — stesso pattern di
 * src/lib/meetingPdf.ts (estratto dalla route API perché serve anche all'invio automatico
 * dell'email, non solo al download manuale).
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

export async function renderReportCommercialePdfBuffer(report: ReportCommercialeDataLoose): Promise<Buffer> {
  const logoBuf = await getLogoBuffer();
  const doc = React.createElement(ReportCommercialePdf, { report, logoBuf });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(doc as any);
  return Buffer.from(pdfBuffer);
}
