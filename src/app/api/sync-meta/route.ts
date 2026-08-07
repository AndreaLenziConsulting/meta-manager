import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { syncCliente } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessione = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { clienteId } = (await req.json()) as { clienteId?: string };
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }
  const cliente = clienti.find((c) => c.clienteId === clienteId)!;

  try {
    const { righe } = await syncCliente(cliente);
    return NextResponse.json({ ok: true, righe });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore sconosciuto" },
      { status: 502 }
    );
  }
}
