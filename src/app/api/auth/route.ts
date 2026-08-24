import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValue,
  verifyConsulentePassword,
  verifyTeamPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { getCommerciali, getConsulenti } from "@/lib/sheets";
import type { Sessione } from "@/types/kpi";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };

  if (!password) {
    return NextResponse.json({ error: "Password errata" }, { status: 401 });
  }

  let sessione: Sessione | null = null;

  if (verifyTeamPassword(password)) {
    sessione = { ruolo: "admin" };
  } else {
    const consulenti = await getConsulenti();
    const match = consulenti.find((c) => c.attivo && verifyConsulentePassword(password, c.password));
    if (match) {
      sessione = { ruolo: "consulente", consulenteId: match.consulenteId };
    } else {
      // verifyConsulentePassword è generica (solo confronto timing-safe) — riusata as-is anche qui.
      const commerciali = await getCommerciali();
      const matchCommerciale = commerciali.find((c) => c.attivo && verifyConsulentePassword(password, c.password));
      if (matchCommerciale) {
        sessione = { ruolo: "commerciale", commercialeId: matchCommerciale.commercialeId };
      }
    }
  }

  if (!sessione) {
    return NextResponse.json({ error: "Password errata" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(sessione), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
