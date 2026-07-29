import { NextRequest, NextResponse } from "next/server";
import { getClienti } from "@/lib/sheets";
import { syncCliente } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clienti = (await getClienti()).filter((c) => c.attivo);

  const risultati: { clienteId: string; righe: number; errore?: string }[] = [];

  for (const cliente of clienti) {
    try {
      const { righe } = await syncCliente(cliente);
      risultati.push({ clienteId: cliente.clienteId, righe });
    } catch (err) {
      risultati.push({
        clienteId: cliente.clienteId,
        righe: 0,
        errore: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, risultati });
}
