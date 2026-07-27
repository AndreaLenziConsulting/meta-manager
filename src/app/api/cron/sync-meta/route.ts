import { NextRequest, NextResponse } from "next/server";
import { ensureCampagnaMapped, getClienti, upsertMetaDailyRows } from "@/lib/sheets";
import { fetchCampaignInsights } from "@/lib/meta";

export const runtime = "nodejs";
export const maxDuration = 60;

// Finestra rolling: rilegge gli ultimi giorni per catturare aggiornamenti tardivi di attribuzione Meta.
const GIORNI_ROLLING = 3;

function formatData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oggi = new Date();
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - GIORNI_ROLLING);
  const since = formatData(inizio);
  const until = formatData(oggi);

  const clienti = (await getClienti()).filter((c) => c.attivo);

  const risultati: { clienteId: string; righe: number; errore?: string }[] = [];

  for (const cliente of clienti) {
    try {
      const { rows, campagne } = await fetchCampaignInsights(
        cliente.adAccountId,
        cliente.clienteId,
        since,
        until
      );
      for (const c of campagne) {
        await ensureCampagnaMapped(c.campaignId, cliente.clienteId, c.nomeCampagna);
      }
      await upsertMetaDailyRows(rows);
      risultati.push({ clienteId: cliente.clienteId, righe: rows.length });
    } catch (err) {
      risultati.push({
        clienteId: cliente.clienteId,
        righe: 0,
        errore: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, periodo: { since, until }, risultati });
}
