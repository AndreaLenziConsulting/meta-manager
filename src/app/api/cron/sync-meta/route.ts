import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { getClienti, getSedi } from "@/lib/sheets";
import { syncCliente } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [clienti, sedi] = await Promise.all([getClienti(), getSedi()]);
  const clientiAttivi = clienti.filter((c) => c.attivo);

  const risultati: { clienteId: string; righe: number; errore?: string }[] = [];

  for (const cliente of clientiAttivi) {
    try {
      const { righe } = await syncCliente(cliente.clienteId, sedi);
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
