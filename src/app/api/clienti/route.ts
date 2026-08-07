import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const sessione = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const clienti = await getClienti();
  return NextResponse.json({
    clienti: clientiVisibili(sessione, clienti).map((c) => ({ clienteId: c.clienteId, nome: c.nome })),
  });
}
