import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidApiKey, isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { syncCliente } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 30;

async function isAutenticato(req: NextRequest): Promise<boolean> {
  if (isValidApiKey(req.headers.get("authorization"))) return true;
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return isValidSessionCookieValue(session);
}

export async function POST(req: NextRequest) {
  if (!(await isAutenticato(req))) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { clienteId } = (await req.json()) as { clienteId?: string };
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }

  const clienti = await getClienti();
  const cliente = clienti.find((c) => c.clienteId === clienteId && c.attivo);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato o non attivo" }, { status: 404 });
  }

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
