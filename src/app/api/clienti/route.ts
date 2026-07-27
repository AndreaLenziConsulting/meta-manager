import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookieValue(session)) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const clienti = await getClienti();
  return NextResponse.json({
    clienti: clienti.filter((c) => c.attivo).map((c) => ({ clienteId: c.clienteId, nome: c.nome })),
  });
}
